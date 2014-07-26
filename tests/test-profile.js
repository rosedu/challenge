global.config = 'development';

var db       = require('../model/db')
var mongoose = require('mongoose')
var core     = require('../core.js');
var profile  = require('../routes/profile.js');

// Import used schemas
var Users = mongoose.model('Users');

// Global initialisation
var req = {}, res = {};


function init_vars(req, res) {
	req.body = {};
	req.session = {};
	req.session.auth = {};
	req.session.auth.github = {};
	req.session.auth.github.user = {};

	res.redirect = function (to) {}
}


function logIn(uid, username) {
	req.session.auth.github.user.id    = typeof uid !== 'undefined' ? uid : '777';
	req.session.auth.github.user.login = typeof username !== 'undefined' ? username : 'test-user';
}



// TEST SUITE
describe('Edit user information',function(){

	before(function(done){
		init_vars(req, res) && logIn()

		// Setup
		req.body.email_pub     = true;
		req.body.user_email    = 'my_email';
		req.body.location      = 'tatooine'
		req.body.user_fullname = 'my_fullname';

		// Add test user if missing
		Users.update(
			{user_id: 777},
			{
	      user_id:       777,
	      user_name:     'test-user',
	      user_fullname: 'Development user',
	      user_email:    'dev@github-connect.com',
	      avatar_url:    'avatars.com',
	      location:      'Somewhere'
    	},
    	{upsert: true}).exec();

		// Run function
		profile.edit(req, res)

		done()
	});

	it('should only change email, fullname or location',function(){
		Users.findOne({'user_id' : 777}).exec(gotUser);

		function gotUser(err, user) {
			user.should.have.property('user_id', 777);
			user.should.have.property('user_name','test-user');
			user.should.have.property('avatar_url','avatars.com');

			user.should.have.property('location','tatooine');
			user.should.have.property('user_email','my_email');
			user.should.have.property('user_fullname','my_fullname');
		}
	  
	});
});
