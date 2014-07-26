var core = require('../core.js');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Challenges = mongoose.model('Challenges');


/*
Add new challenge.
*/
exports.index = function(req, res) {

  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser(err, user) {
    res.render('admin', {
      title: 'New challenge',
      user: user
    });
  }

};

/*
Add info from form to db.
*/
exports.challenge_add = function(req, res) {

  // Add all admins in list even if they do not exist
  new Challenges({
    name:         req.body.name,
    link:         req.body.name.replace(/\s+/g, ''),
    description:  req.body.description,
    admins:       req.body.admins.split(' ')
  }).save(savedChallenge);

  function savedChallenge(err, todo, count) {
    console.log("* Challenge " + req.body.name + " saved.");
    res.redirect('/challenges');
  }
};