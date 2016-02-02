var MACRO = require('../model/macro.js');
var core = require('../core.js');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Challenges = mongoose.model('Challenges');
var Pulls = mongoose.model('Pulls');
var Results = mongoose.model('Results');
var https = require('https');
var markdown = require( "markdown" ).markdown;

/*
View all challenges.
*/
exports.index = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);
  var _self = {};

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser(err, user) {
    _self.user = user;

    Challenges.find().exec(gotChallenges);
  }

  function gotChallenges(err, ch) {
    ch.forEach(function(challenge) {

      // Markdown description
      challenge.description_mk = markdown.toHTML(challenge.description);

      // Count PR
      challenge.created = 0
      challenge.pulls.forEach(function(pull) {
        if (pull.auth && !pull.hide) challenge.created++
      });
    });

    res.render('challenges', {
      title:      "All challenges",
      user:       _self.user,
      challenges: ch
    })
  };
};

/*
Single challenge page.
*/
exports.one = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var _self = {};
  var preq = [];

  _self.err = req.query.err

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser(err, user) {
    _self.user = user;
    Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);
  }

  function gotChallenge(err, ch) {
    if (!ch) return res.render('404', {title: "404: File not found"});

    // Formate dates
    ch.end_f = "", ch.start_f = "";
    if (ch.start) {
      ch.start_f += ("0" + ch.start.getUTCDate()).slice(-2) + "/";
      ch.start_f += ("0" + (ch.start.getUTCMonth()+1)).slice(-2) + "/";
      ch.start_f += ch.start.getUTCFullYear();
    }
    if (ch.end) {
      ch.end_f += ("0" + ch.end.getUTCDate()).slice(-2) + "/";
      ch.end_f += ("0" + (ch.end.getUTCMonth()+1)).slice(-2) + "/";
      ch.end_f += ch.end.getUTCFullYear();
    }

    // Markdown description and about section
    ch.description_mk = markdown.toHTML(ch.description);
    ch.about_mk = markdown.toHTML(ch.about);

    // Check if current user is admin
    if (uid && ch.admins.indexOf(req.session.auth.github.user.login) > -1)
      _self.user.admin = true;
    else if (req.path.substring(req.path.lastIndexOf('/')) == '/admin')
      return res.redirect('/challenges/' + req.params.ch);

    // Init individual repos pull req counters
    ch.created_no = [];
    ch.merged_no = [];
    ch.repos.forEach(function(repo) {
      ch.created_no[repo] = 0;
      ch.merged_no[repo] = 0; 
    });

    // Get number of merged pull req and
    // count pulls for each
    ch.merged = 0, ch.created = 0;

    ch.pulls.forEach(function(pullParam) {

      // Count pull req
      ch.repos.forEach(function(repoParam) {
        if(repoParam == pullParam.repo && !pullParam.hide) {
          ch.created_no[repoParam]++;
          if(pullParam.merged && pullParam.auth)
            ch.merged_no[repoParam]++;
        }

        if(pullParam.auth && !pullParam.hide) {
          // Total created pulls count
          ch.created++;
          // Total merged pulls count
          if(pullParam.merged) ch.merged++;
        }
      });

    });

    // Save values
    _self.ch = ch;

    // Check if current user joined challenge
    if (uid) _self.user.joined = false;
    if (uid && ch.users.indexOf(req.session.auth.github.user.login) > -1)
      _self.user.joined = true;

    if (req.path.substring(req.path.lastIndexOf('/')) == '/users') {
      Users.find({'user_name': {$in: _self.ch.users}}).exec(gotPeople);
    } else if (req.path.substring(req.path.lastIndexOf('/')) == '/results') {
      Results.find().sort({'total': -1}).exec(gotResults);
    } else {
      renderPage();
    }
  }

  function gotResults(err, results) {
    _self.results = results;
    renderPage();
  }

  function gotPeople(err, people) {
    _self.people = people;
    renderPage();
  }

  function renderPage() {
    res.render('challenge', {
      'title':      _self.ch.name,
      'user':       _self.user,
      'currentUrl': req.path,
      'challenge':  _self.ch,
      'pulls':      _self.ch.pulls,
      'people':     _self.people,
      'scores':    _self.results,
      'err':        _self.err
    });
  }
};

/*
Edit challenge info and redirect to new link.
Redirect if user not in admin list
*/
exports.edit = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch);

    // Check if no repos specified (remove empty string)
    var split = [];
    if (req.body.repos == "") req.body.repos = null;
    else split = req.body.repos.split(' ');

    // Update challenge info
    var pattern = /(\d{2})\/(\d{2})\/(\d{4})/;
    var conditions = {'link': req.params.ch};
    var update = {
      $addToSet: {'repos': {$each: split}},
      $set: {
        'name':        req.body.name,
        'status':      req.body.status,
        'link':        req.body.name.replace(/\s+/g, ''),
        'email':       req.body.email,
        'logo':        req.body.logo,
        'about':       req.body.about,
        'description': req.body.description,
        'start':       new Date(req.body.start.replace(pattern, '$3-$2-$1')),
        'end':         new Date(req.body.end.replace(pattern, '$3-$2-$1'))
    }};
    Challenges.update(conditions, update, function (err, num) {
      console.log("* Owner made changes to challenge " + req.body.name);
      res.redirect('/challenges/' + req.body.name.replace(/\s+/g, '') + '/admin');
    });
  }
};

/*
Change challenge formulae by which users are quantified.
*/
exports.update_formulae = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge)

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch)


    display_scores = false
    if (req.body.display_scores == 'on')
      display_scores = true

    var conditions = {'link': req.params.ch};
    var update = {$set: {
      'formulae': req.body.formulae,
      'display_scores': display_scores
    }}
    Challenges.update(conditions, update, function (err, num) {
      console.log("* Changed formulae for " + req.params.ch)

      // Check used forumulae
      score = core.eval_formulae(req.body.formulae)
      if (score === null) {
        res.redirect('/challenges/' + req.params.ch + '/admin?err=invalid_formulae')

      } else {
        res.redirect('/challenges/' + req.params.ch + '/admin')

        // Update score for every PR
        for (var i=0; i<ch.pulls.length; i++) {
          score = core.eval_formulae(req.body.formulae, ch.pulls[i])

          var conditions = {'pulls._id': ch.pulls[i]._id}
          var update = {$set: {'pulls.$.score': score}}
          Challenges.update(conditions, update).exec()
        }
      }
    })
  }
};

/*
Join challenge. Closed challenges cannot be joined.
*/
exports.join = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    if (ch.status != 'closed') {
      var conditions = {'link': req.params.ch};
      var update = {$addToSet: {'users': req.session.auth.github.user.login}};
      Challenges.update(conditions, update, function (err, num) {
        res.redirect('/challenges/' + req.params.ch);
      });

    } else {
      res.redirect('/challenges/' + req.params.ch);
    }
  }
};

/*
Manually refresh challenges.
*/
exports.refresh = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    core.refresh_challenges();
    res.redirect('/challenges/' + req.params.ch);
  }
};

/*
Rate Pull Request from list.
*/
exports.rate = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch)

    var conditions = {'pulls._id': new mongoose.Types.ObjectId(req.query.id)}
    var update = {$set: {'pulls.$.rating': req.body.rating}}
    Challenges.update(conditions, update, function (err, num) {
      res.redirect('/challenges/' + req.params.ch + '/pulls')
    });
  }
};

/*
Hide commit from list.
*/
exports.hide_commit = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch)

    var conditions = {'pulls._id': new mongoose.Types.ObjectId(req.query.id)}
    var update = {$set: {'pulls.$.hide': true}}
    Challenges.update(conditions, update, function (err, num) {
      console.log("* Hide commit " + req.query.id)
      res.redirect('/challenges/' + req.params.ch + '/pulls')
    });
  }
};

/*
Display commit from list.
*/
exports.display_commit = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch)

    var conditions = {'pulls._id': new mongoose.Types.ObjectId(req.query.id)}
    var update = {$set: {'pulls.$.hide': false}}
    Challenges.update(conditions, update, function (err, num) {
      res.redirect('/challenges/' + req.params.ch + '/pulls')
    });
  }
};

/*
Add new admin to list.
Only admins can add other admins.
*/
exports.admin_add = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch);

    var conditions = {'link': req.params.ch};
    var update = {$addToSet: {'admins': req.body.admin}};
    Challenges.update(conditions, update, function (err, num) {
      console.log("* New admin added to " + req.body.name);
      res.redirect('/challenges/' + req.params.ch + '/admin');
    });
  }
};

/*
Remove admin. Only admins can remove other admins.
An admin can remove himself.
*/
exports.admin_remove = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch);

    var conditions = {'link': req.params.ch};
    var update = {$pull: {'admins': req.query.name}};
    Challenges.update(conditions, update, function (err, num) {
      console.log("* Admin removed from " + req.body.name);
      res.redirect('/challenges/' + req.params.ch + '/admin');
    });
  }
};

/*
Remove repo. Only admins can remove repos.
*/
exports.repo_remove = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch);

    var conditions = {'link': req.params.ch};
    var update = {$pull: {'repos': req.query.repo}};
    Challenges.update(conditions, update, function (err, num) {
      console.log("* Admin removed repo from " + req.query.repo);
      res.redirect('/challenges/' + req.params.ch + '/admin');
    });
  }
};

/*
Send email to all users in challenge.
Only admins can do this.
*/
exports.email_users = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch);

    Users.find({'user_name': {$in: ch.users}}).select('user_email').exec(gotUsers);

    res.redirect('/challenges/' + req.params.ch + '/admin');
  }

  function gotUsers(err, users) {
    for (var i=0; i<users.length; i++) {
      core.send_mail(users[i].user_email, 'challenge', req.body.email_msg, req.body.email_sub)
    }
  }
};

/*
Temporat route to populate results.
Puts 0 for hidden pull requests.
*/
exports.update_results = function(req, res) {
  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {

    results = {}
    ch.pulls.forEach(function (pr) {
      if (!pr.hide && pr.auth in results) {
        results[pr.auth] += pr.score
      } else if (!pr.hide){
        results[pr.auth] = pr.score
      } else {
        results[pr.auth] = 0
      }
    })

    // Push updates to results collection
    results.forEach(function(resultParam) {
      update = {
        'auth':      resultParam,
        'total':     results[author],
        'challenge': ch._id
      }

      Results.update({'auth': resultParam}, update, {upsert: true}).exec()
    });
    
    res.redirect('/challenges/' + ch.link)
  }
};
