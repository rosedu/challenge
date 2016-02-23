var mongoose = require('mongoose');
var Users    = mongoose.model('Users');
var Challenges = mongoose.model('Challenges');
var Notifications = mongoose.model('Notifications');
var core     = require('../core.js');

/*
Shows number of registered users, projects and ideas.
Get user info if logged in.
*/
exports.index = function(req, res) {
  var uid   = req.user ? req.user.user_id : null
  var _self = {}

  Users.count().exec(gotUsers)

  function gotUsers(err, users) {
    _self.users = users;
    Users.findOne({'user_id': uid}).exec(gotUser);
  }

  function gotUser(err, user) {
    _self.user = user
    Challenges.find().exec(gotChallenges)
  }

  function gotChallenges(err, ch) {
    _self.lines = 0;
    _self.pulls = 0;

    ch.forEach(function(challenge) {
      challenge.pulls.forEach(function(pull) {
        if (!pull.hide) {
          _self.pulls++

          // Count number of edited lines, if present
          if (pull.lines_inserted)
            _self.lines += pull.lines_inserted
          if (pull.lines_removed)
            _self.lines += pull.lines_removed
        }
      })
    })

    render()
  }

  function render(err, user) {
    res.render('index', {
      title:    "ROSEdu Challenge",
      user:     _self.user,
      users:    _self.users,
      pulls:    _self.pulls,
      lines:    _self.lines
    })
  }
}


/*
Show login button or redirect to page if user already logged in.
*/
exports.login = function(req, res) {
  if (req.user) return res.redirect('/' + req.user.user_name);

  res.render('login', {
    'title':  "Log in",
    'status': global.config.status,
    'tab':    req.query.rf
  });
};


/*
Feedback form processing.
Sends email to owner and redirects to login page with message.
*/
exports.feedback = function(req, res) {
  if (req.body.email && req.body.msg) {
    core.send_mail(null, 'feedback', req.body);
    res.redirect('/login?rf=back');

  } else {
    res.redirect('/contact');
  }
};


/*
Coantact page holds feedback form.
*/
exports.contact = function(req, res) {
  var uid   = req.user ? req.user.user_id : null;

  Users.findOne({ user_id: uid }, function(err, user) {
    if (err) return handleError(err);

    res.render('contact', {
      title:  "Get in touch with us",
      user:   user
    });
  });
};


/*
FAQ page.
*/
exports.faq = function(req, res) {
  var uid   = req.user ? req.user.user_id : null

  Users.findOne({ user_id: uid }, function(err, user) {
    if (err) return handleError(err);

    res.render('faq', {
      title:  "F.A.Q.",
      user:   user
    });
  });
};
