var MACRO = require('./model/macro.js');
var mongoose = require('mongoose');
var https = require('https');
var fs = require('fs');

var Users = mongoose.model('Users');
var Notifications = mongoose.model('Notifications');
var Challenges = mongoose.model('Challenges');

var nextUserId = 0;
global.usersById = {};
var usersByGhId = {};


exports.send_mail = function (destination, type, body) {
  var nodemailer = require("nodemailer");

  // create reusable transport method (opens pool of SMTP connections)
  var smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
      user: global.config.mail_user,
      pass: global.config.mail_pass
    }
  });

  fs.readFile(__dirname + '/public/emails/' + type + '.html', 'utf8', function (err, html) {
      var mailOpt = {};

      if (type == 'welcome') {
        mailOpt['from']    = "welcome@gconnect.com";
        mailOpt['to']      = destination,
        mailOpt['subject'] = 'Welcome to Github-connect',
        mailOpt['text']    = '',
        mailOpt['html']    = html;
      } else if (type == 'feedback') {
        mailOpt['from']    = "welcome@gconnect.com";
        mailOpt['to']      = 'cmarius02@gmail.com',
        mailOpt['subject'] = 'Feedback Github-connect: ' + body.email,
        mailOpt['text']    = body.msg
      }

      // send mail with defined transport object
      smtpTransport.sendMail(mailOpt, function(err, response){
        if (err) console.log(err);
        else console.log("* Email sent to " + destination);

        smtpTransport.close();
      });
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

exports.get_followers = function (user_name, accessToken, notify) {
  var options = {
    host: "api.github.com",
    path: "/users/" + user_name + "/followers?access_token=" + accessToken,
    method: "GET",
    headers: { "User-Agent": "github-connect" }
  };

  var request = https.request(options, function(response){
    var body = '';
    response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
    response.on("end", function(){
      var json = JSON.parse(body);

      if (notify) { // check old value
        Users.findOne({user_name: user_name}, function(err, user) {
          var msg, diff = user.followers_no - json.length;
          if (diff > 0) msg = "lost " + diff;
          else if (diff < 0) msg = -(diff) + " new";

          // notify user only if we have some action going on
          if (diff != 0) {
            new Notifications({
              src:    "",
              dest:   user.user_name,
              type:   "followers_no",
              seen:   false,
              date:   Date.now(),
              link:   msg
            }).save(function(err, todo, count ) {
              if (err) console.log("[ERR] Notification not sent.");
            });

            var conditions = {user_name: user.user_name};
            var update = {$set: {unread: true}};
            Users.update(conditions, update).exec();
          }
        });
      }

      // update user info
      var conditions = {user_name: user_name};
      var update = {$set: {followers_no: json.length}};
      Users.update(conditions, update).exec();
    });
  });
  request.end();
}

exports.get_following = function (user_name, accessToken, notify) {
  var options = {
    host: "api.github.com",
    path: "/users/" + user_name + "/following?access_token=" + accessToken,
    method: "GET",
    headers: { "User-Agent": "github-connect" }
  };

  var request = https.request(options, function(response){
    var body = '';
    response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
    response.on("end", function(){
      var json = JSON.parse(body);

      if (notify) { // check old value
        Users.findOne({user_name: user_name}, function(err, user) {
          var msg, diff = user.following_no - json.length;
          if (diff > 0) msg = "lost " + diff;
          else if (diff < 0) msg = -(diff) + " new";

          // notify user only if we have some action going on
          if (diff != 0) {
            new Notifications({
              src:    "",
              dest:   user.user_name,
              type:   "following_no",
              seen:   false,
              date:   Date.now(),
              link:   msg
            }).save(function(err, todo, count ) {
              if (err) console.log("[ERR] Notification not sent.");
            });

            var conditions = {user_name: user.user_name};
            var update = {$set: {unread: true}};
            Users.update(conditions, update).exec();
          }
        });
      }

      // update user info
      var conditions = {user_name: user_name};
      var update = {$set: {following_no: json.length}};
      Users.update(conditions, update).exec();
    });
  });
  request.end();
}


exports.login = function(sess, accessToken, accessTokenExtra, ghUser) {
  sess.oauth = accessToken;
  if (typeof usersByGhId[ghUser.id] === 'undefined') {

    usersByGhId[ghUser.id] = addUser('github', ghUser);

    Users
    .findOne({ 'user_id': usersByGhId[ghUser.id].github.id },
               'user_name', function (err, user) {
      if (err) return handleError(err);
      if (user != null) {
        // update last_seen
        var conditions = {user_name: usersByGhId[ghUser.id].github.login};
        var update = {$set: {last_seen: Date.now()}};
        Users.update(conditions, update, function (err, num) {
          console.log("* User " + user.user_name + " logged in.");
        });
        // update followers number and notify
        module.exports.get_followers(user.user_name, accessToken, true);
        // update following number and notify
        module.exports.get_following(user.user_name, accessToken, true);

      } else {
        // send welcome notification
        new Notifications({
          src:    null,
          dest:   usersByGhId[ghUser.id].github.login,
          type:   "welcome",
          seen:   false,
          date:   Date.now(),
          link:   "/faq"
        }).save(function(err, todo, count) {
          if (err) console.log("[ERR] Notification not sent.");
        });

        // Import data from github
        return new Users ({
          user_id:       usersByGhId[ghUser.id].github.id,
          user_name:     usersByGhId[ghUser.id].github.login,
          user_fullname: usersByGhId[ghUser.id].github.name,
          user_email:    usersByGhId[ghUser.id].github.email,
          avatar_url:    usersByGhId[ghUser.id].github.avatar_url,
          location:      usersByGhId[ghUser.id].github.location,
          join_github:   usersByGhId[ghUser.id].github.created_at,
          join_us:       Date.now(),
          last_seen:     Date.now()
        }).save (function (err, user, count) {
          console.log("* User " + user.user_name + " added.");
          // update followers number
          module.exports.get_followers(user.user_name, accessToken, false);
          // update following number
          module.exports.get_following(user.user_name, accessToken, false);
          // send welcome email
          module.exports.send_mail(user.user_email, 'welcome');
        });
      }
    });
    return usersByGhId[ghUser.id];

  } else {
    return usersByGhId[ghUser.id];
  }
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
      var update = {$set: { 'refresh': Date.now()}};
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
          response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
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

                // Check if merge date exists
                var merge_date;

                if (!pulls[p].merged_at) merge_date = null;
                else merge_date = new Date(pulls[p].merged_at);

                var update = {$addToSet: { 'pulls': {
                  repo:      ch.repos[1],
                  auth:      pulls[p].user.login,
                  url:       pulls[p].html_url,
                  title:     pulls[p].title,
                  created:   new Date(pulls[p].created_at),
                  merged:    merge_date
                }}};

                Challenges.update({'link': ch.link}, update).exec();
              }
            }

          });
        });
        request.end();
      }
    }
  }
}