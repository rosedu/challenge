var passport       = require('passport');
var mongoose       = require('mongoose');
var GitHubStrategy = require('passport-github').Strategy;

var User          = mongoose.model('Users');
var Notifications = mongoose.model('Notifications');

var core = require('./core.js');


module.exports = function(app, passport) {

  // used to serialize the user for the session
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  // used to deserialize the user
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });


  // GITHUB
  passport.use(new GitHubStrategy({
    clientID          : global.config.gh_clientId || ' ',
    clientSecret      : global.config.gh_secret || ' ',
    passReqToCallback : true

  }, function(req, token, refreshToken, profile, done) {
    process.nextTick(function() {

      User.findOne({'user_id': profile.id}, function(err, user) {
        if (err) return done(null, false, req.flash('error', err))

        if (user != null) {
          var conditions = {'user_name': profile.username};
          var update = {$set: {
            'last_seen':     Date.now(),
            'user_fullname': profile.displayName,
            'user_email':    (profile.emails ? profile.emails[0].value : null),
            'followers_no':  profile._json.followers,
            'following_no':  profile._json.following,
            'location':      profile._json.location,
          }};
          User.update(conditions, update, function (err, num) {
            console.log("* User " + user.user_name + " logged in at " + Date.now());
          });

        } else {
          // Send welcome notification
          new Notifications({
            'src':    null,
            'dest':   profile.username,
            'type':   "welcome",
            'link':   "/faq"
          }).save(function(err, todo, count) {
            if (err) console.log("[ERR] Notification not sent.");
          });

          // Import data from github
          user = new User ({
            'user_id':       profile.id,
            'user_name':     profile.username,
            'user_fullname': profile.displayName,
            'user_email':    (profile.emails ? profile.emails[0].value : null),
            'avatar_url':    profile._json.avatar_url,
            'followers_no':  profile._json.followers,
            'following_no':  profile._json.following,
            'location':      profile._json.location,
            'join_github':   profile._json.created_at
          }).save (function (err, user, count) {
            console.log("* User " + user.user_name + " added.");
            // send welcome email
            core.send_mail(user.user_email, 'welcome');
          });
        }

        // Return one happy user
        return done(null, user)
      })
    })
  }))
}
