var core = require('../core.js');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Challenges = mongoose.model('Challenges');


/*
Add new challenge.
*/
exports.index = function(req, res) {

  var _self = {};
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.find().exec(gotAll);

  function gotAll(err, all) {
    _self.users = all;
    Users.findOne({'user_id': uid}).exec(gotUser);
  }

  function gotUser(err, user) {
    res.render('admin', {
      'title':  'New challenge',
      'user':   user,
      'users':  _self.users
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
  }).save(function(err){
    //if err -> render admin page again
    if(err)
    {
      var _self = {};
      var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

      Users.find().exec(gotAll);

      function gotAll(err, all) {
        _self.users = all;
        Users.findOne({'user_id': uid}).exec(gotUser);
      }

      function gotUser(err, user) {
        res.render('admin', {
          'title':  'New challenge',
          'user':   user,
          'users':  _self.users,
          'error': 'Challenge name should be unique.',
          'description': req.body.description,
          'admins': req.body.admins
        });
      }
    }
    else
      res.redirect('/challenges');
  });
};