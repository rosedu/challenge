var mongoose      = require('mongoose');
var Users         = mongoose.model('Users');
var Challenges    = mongoose.model('Challenges');
var Notifications = mongoose.model('Notifications');
var core 		      = require('../core.js');


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

    challenges.forEach(function(challenge) {
      if (challenge.users.indexOf(_self.cuser.user_name) > -1) {
        challenge.joined = true;
        _self.joined = true;
      }
    }); 

    // for (var ch in challenges) {
    //   if (challenges[ch].users.indexOf(_self.cuser.user_name) > -1) {
    //     challenges[ch].joined = true
    //     _self.joined = true
    //   }
    // }

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
          .exec(function(err, notifs) {

            notifs.forEach(function(notif) {
              // Format date
              notif.date_f = core.get_time_from(notif.date);
            });

            // for (var i in notif) {
            //   // Format date
            //   notif[i].date_f = core.get_time_from(notif[i].date);
            // }

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
