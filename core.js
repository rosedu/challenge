var mongoose   = require('mongoose');
var nodemailer = require("nodemailer");
var https      = require('https');
var fs         = require('fs');
var url        = require('url');
var md5        = require('md5');

var MACRO = require('./model/macro.js');

var Users = mongoose.model('Users');
var Notifications = mongoose.model('Notifications');
var Challenges = mongoose.model('Challenges');

var nextUserId = 0;
global.usersById = {};
var usersByGhId = {};


exports.send_mail = function (destination, type, body, subject) {
  if (!global.config.mail_user || !global.config.mail_pass) {
    console.log('Missing user/pass for SMTP connection. Cannot send email.')
    return;
  }

  // Create reusable transport method (opens pool of SMTP connections)
  var smtpURL = 'smtps://' + global.config.mail_user + ':'
  smtpURL += global.config.mail_pass + '@smtp.gmail.com'
  var smtpTransport = nodemailer.createTransport(smtpURL);


  fs.readFile(__dirname + '/public/emails/' + type + '.html', 'utf8', function (err, html) {
    // Default email source and destiantion
    var mailOpt = {
      'from': 'ROSEdu Challenge <challenge@lists.rosedu.org>',
      'to':   destination
    }

    // Handle different types of emails
    if (type == 'welcome') {
      mailOpt['subject'] = 'Welcome to Challenge by ROSEdu',
      mailOpt['text']    = '',
      mailOpt['html']    = html;
    } else if (type == 'feedback') {
      mailOpt['to']      = 'challenge@lists.rosedu.org',
      mailOpt['subject'] = 'Feedback: ' + body.email,
      mailOpt['text']    = body.msg
    } else if (type == 'challenge') {
      mailOpt['subject'] = subject,
      mailOpt['text']    = body
    }

    // Send mail using previously defined transport object
    smtpTransport.sendMail(mailOpt, function(err, response){
      if (err) console.log(err);
      else console.log("* " + type + " email sent to " + mailOpt['to']);
    });
    smtpTransport.close();
  });
}


function addUser (source, sourceUser) {
  var user;
  if (arguments.length === 1) { // password-based
    user = sourceUser = source;
    user.id = ++nextUserId;
    return usersById[nextUserId] = user;
  } else { // non-password-based
    user = usersById[++nextUserId] = {id: nextUserId};
    user[source] = sourceUser;
  }
  return user;
}

exports.get_time_from = function (then) {
  var now = Date.now();

  // interval between time now and db date
  var msec = now - new Date(then).getTime();

  var hh = Math.floor(msec / 1000 / 60 / 60);
  if (hh > 24) { // older that 24 hours
    // return actual date
    return "on " + then.toString().substring(4, 15);

  } else if (hh > 1) { // older than 1 hour
    return hh + " hours ago";

  } else {
    msec -= hh * 1000 * 60 * 60;
    var mm = Math.floor(msec / 1000 / 60);

    if (mm > 1) { // older than 1 mnute
      return mm + " minutes ago";

    } else {
      return "one minute ago";
    }
  }
}


function create_patch_request(ch, pull) {
    var patch_url = pull.url;
    var patch_url_host = url.parse(patch_url, true).host;
    var patch_url_path = url.parse(patch_url, true).pathname;

    var patch_options = {
      host: patch_url_host,
      path: patch_url_path,
      method: "GET",
      headers: { "User-Agent": "github-connect" }
    };

    var patch_request = https.request(patch_options, function(response) {
      var pull_body = '';

      response.on("data", function(chunk) {
        pull_body+=chunk.toString("utf8");
      });

      response.on("end", function() {
        var pull_info = JSON.parse(pull_body);

        // Check if merge date exists
        var merge_date;

        if (!pull.merged_at) merge_date = null;
        else merge_date = new Date(pull.merged_at);

        // Generate unique PR id
        var oid = md5(pull.html_url).substring(0,12)

        var update = {$set: {
          'pulls.$.title':          pull.title,
          'pulls.$.created':        new Date(pull.created_at),
          'pulls.$.merged':         merge_date,
          'pulls.$.lines_inserted': pull_info.additions,
          'pulls.$.lines_removed':  pull_info.deletions,
          'pulls.$.files_changed':  pull_info.changed_files
        }}

        Challenges.update({'pulls.url': pull.html_url}, update, function (err, count) {
          // No updates were made, object did not exist, let's push it
          if (count.nModified == 0) {
            var newpr = {
              '_id':            new mongoose.Types.ObjectId(oid),
              'repo':           pull.base.repo.full_name,
              'auth':           pull.user.login,
              'hide':           false,
              'url':            pull.html_url,
              'title':          pull.title,
              'created':        new Date(pull.created_at),
              'merged':         merge_date,
              'score':          0,
              'rating':         0,
              'lines_inserted': pull_info.additions,
              'lines_removed':  pull_info.deletions,
              'files_changed':  pull_info.changed_files
            }

            // Update score if formulae is valid
            if (exports.eval_formulae(ch.formulae))
              newpr['score'] = exports.eval_formulae(ch.formulae, newpr)

            Challenges.update({'link': ch.link}, {$push: {pulls: newpr}}).exec()
          }
        })
      });

    });
    patch_request.end();
}

/*
Replace individual constants in formulae with actual values
and supply a result.

If pull argument is missing, test arithmetic expression using a default value
and try to evaluate expression. Returns null if failed.

IL - Inserted lines
RL - Removed lines
FC - Files changed
R  - Rating
*/
exports.eval_formulae = function(formulae, pull) {

  // Default test value, if parameter is missing
  pull = pull || {
    'lines_inserted': 0,
    'lines_removed': 0,
    'files_changed': 0,
    'rating': 0
  }

  // Replace all occurances
  formulae = formulae.replace(/IL/g, pull.lines_inserted)
  formulae = formulae.replace(/RL/g, pull.lines_removed)
  formulae = formulae.replace(/FC/g, pull.files_changed)
  formulae = formulae.replace(/R/g,  pull.rating)

  try {
    score = eval(formulae)
  } catch(err) {
    score = null
  }

  return score
}

/*
Refresh all repos from all challeneges that are active ('live').
*/
exports.refresh_challenges = function() {

  Challenges.find({'status': 'live'}).exec(gotChallenges);

  function gotChallenges(err, all) {

    // For each challenge in pool
    for (var c in all) {

      var ch = all[c];

      // Update last refresh date
      var update = {$set: {'refresh': Date.now()}};
      Challenges.update({'link': ch.link}, update).exec();

      //New request for each repo of challenge
      for (var r=0; r<ch.repos.length; r++) {

        var options = {
          host: "api.github.com",
          path: "/repos/" + ch.repos[r] + "/pulls?state=all",
          method: "GET",
          headers: { "User-Agent": "github-connect" }
        };

        var request = https.request(options, function(response){
          var body = '';

          response.on("data", function(chunk){
            body+=chunk.toString("utf8");
          });

          response.on("end", function(){
            var pulls = JSON.parse(body);

            // Log errors
            if (pulls.message)
              console.log("[ERR] " + pulls.message + " - " + options.path
                + " (" + pulls.documentation_url + ")");

            for (var p in pulls) {

              // Accept only pulls created after challenge start date, before end
              // date and only from registered users
              if (new Date(pulls[p].created_at).getTime() > ch.start.getTime() &&
                  new Date(pulls[p].created_at).getTime() < ch.end.getTime() &&
                  ch.users.indexOf(pulls[p].user.login) > -1) {

                create_patch_request(ch, pulls[p]);
              }
            }
          });
        });
        request.end();

      }
    }
  }
}

/*
Adds dummy user with given id and username to db.
This is used during development when multiple users are needed for testing
purposes.
*/
exports.add_user = function(userid, username, callback) {
  var update = {
    'user_id':       userid,
    'user_name':     username,
    'user_fullname': 'Development user',
    'user_email':    'dev@github-connect.com',
    'avatar_url':    'https://avatars.githubusercontent.com/u/0',
    'location':      'Somewhere'
  }

  Users.update({'user_id': userid}, update, {'upsert': true}).exec(function (err) {
    Users.findOne({'user_id': userid}).exec(function (err, user) {
      callback(err, user);
    });
  });
}
