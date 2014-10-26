var mongoose      = require('mongoose');
var Users         = mongoose.model('Users');
var Challenges    = mongoose.model('Challenges');
var Notifications = mongoose.model('Notifications');
var core 		      = require('../core.js');


/*
Edit user information.
Can change location (+visibility), email (+visibility), full name.
*/
exports.edit = function(req, res) {
  var email = false, loc = false;
  if (req.body.email_pub) email = true;
  if (req.body.location_pub) loc = true;

  var conditions = { 'user_id': req.session.auth.github.user.id };
  var update = {$set: {
    'location': 			req.body.location,
    'user_fullname':  req.body.fullname,
    'user_email': 		req.body.email,
    'location_pub':   loc,
    'email_pub':  		email
  }};
  Users.update(conditions, update, function (err, num) {
    console.log("* " + req.session.auth.github.user.login + " made profile changes.");
    res.redirect('/' + req.session.auth.github.user.login);
  });
}


/*
User profile page. Shows all info about selected user.
*/
exports.index = function(req, res) {
  var _self = {}
  var cname = req.url.substring(1, (req.url + '/').substring(1).indexOf('/')+1);
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne ({ 'user_name': cname }, function(err, cuser) {
    if (!cuser) return res.status(404).render('404', {title: "404: File not found"})
    else {
      Users.findOne({'user_id': uid}, function(err, user) {

        _self.user = user
        _self.cuser = cuser
        Challenges.find().exec(gotChallenges)
      })
    }
  })

  function gotChallenges(err, challenges) {
    // User joined some challenges
    _self.joined = false

    // Mark challenges joined by current user
    for (var ch in challenges) {
      if (challenges[ch].users.indexOf(_self.cuser.user_name) > -1) {
        challenges[ch].joined = true
        _self.joined = true
      }
    }

    res.render('profile', {
      'title':      _self.cuser.user_fullname,
      'currentUrl': '',
      'challenges': challenges,
      'cuser':      _self.cuser,
      'user':       _self.user,
      'joined':     _self.joined
    });
  }
}

/*
Notifications tab.
*/
exports.notifications = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne ({ 'user_name': req.params.user }, function(err, cuser) {
    if (!cuser) return res.render('404', {title: "404: File not found"});
    else {

      Users.findOne ({ 'user_id': uid }, function(err, user) {

        // Users must only see their own notifications
        if (!user || user.user_name != cuser.user_name) {
          return res.redirect('/' + cuser.user_name);

        } else {
          // Update general unread
          var conditions = {user_name: cuser.user_name};
          var update = {$set: {unread: false}};
          Users.update(conditions, update).exec();

          Notifications
          .find({ 'dest': cuser.user_name })
          .sort({ 'date' : -1 })
          .exec(function(err, notif) {

            for (var i in notif) {
              // Format date
              notif[i].date_f = core.get_time_from(notif[i].date);
            }

            res.render('profile', {
              'title':      cuser.user_fullname,
              'currentUrl': 'notifications',
              'cuser':      cuser,
              'notif':      notif,
              'user':       user
            })

          })
        }
      })
    }
  })
}


/*
Repositories tab.
*/
exports.repos = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne ({ 'user_name': req.params.user }, function(err, cuser) {
    if (!cuser) return res.render('404', {title: "404: File not found"});
    else {

      Users.findOne ({ 'user_id': uid }, function(err, user) {

        res.render('profile', {
          'title':      cuser.user_fullname,
          'currentUrl': 'repos',
          'cuser':      cuser,
          'projects':   '',
          'ideas':      '',
          'user':       user
        })

      })
    }
  })
}


/*
Edit profile tab.
*/
exports.edit_profile = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne ({ 'user_name': req.params.user }, function(err, cuser) {
    if (!cuser) return res.render('404', {title: "404: File not found"});
    else {

      Users.findOne ({ 'user_id': uid }, function(err, user) {

        // Users can edit only their own profile
        if (!user || user.user_name != cuser.user_name)
          res.redirect('/' + cuser.user_name);
        else
          res.render('profile', {
            'title':      cuser.user_fullname,
            'currentUrl': 'edit_profile',
            'cuser':      cuser,
            'projects':   '',
            'ideas':      '',
            'user':       user
          })

      })
    }
  })
}



/*
Remove user account and all associated content.
Keep username in notifications (as src) and Challenges. When someone clicks
on his name, they will get 404.
*/
exports.remove = function(req, res) {
  res.redirect('/logout')

  var user = req.session.auth.github.user.login

  // Remove all ideas
  Ideas.remove({'user_name': user}, function (err, num) {
    if (err) console.log("[ERR] Could not remove ideas.");
  })

  // Remove all idea comments
  IdeaComments.remove({'user_name': user}, function (err, num) {
    if (err) console.log("[ERR] Could not remove idea comments.");
  })

  // Remove all projects
  Projects.remove({'user_name': user}, function (err, num) {
    if (err) console.log("[ERR] Could not remove projects.");
  })

  // Remove all project comments
  ProjectComments.remove({'user_name': user}, function (err, num) {
    if (err) console.log("[ERR] Could not remove project comments.");
  })

  // Remove notifications that he received
  Notifications.remove({'dest': user}, function (err, num) {
    if (err) console.log("[ERR] Could not remove user notifications.");
  })

  // Remove user data
  Users.remove({'user_name': user}, function (err, num) {
    if (err) console.log("[ERR] Could not remove user info.");
  })

}
