var express = require('express')
var app = module.exports = express()
global.config = {}

if ('development' == app.get('env')) {
  global.config.redis_secret = 'big secret'
  //global.config = require('./lib/config')
  global.config.status = 'dev'
  global.config.login = process.argv[2]
}

if ('production' == app.get('env')) {
  global.config.gh_clientId  = process.env.clientId;
  global.config.gh_secret    = process.env.secret;
  global.config.redis_secret = process.env.redis_secret;

  global.config.wm_clientId = process.env.wm_clientId;
  global.config.wm_secret   = process.env.wm_secret;

  global.config.mail_user = process.env.mail_user;
  global.config.mail_pass = process.env.mail_pass;

  global.config.status = 'prod';
}


var MACRO = require('./model/macro.js')
  , db = require('./model/db')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , mongoose = require('mongoose')
  , core = require('./core.js')
  , cron = require('cron').CronJob
  , favicon = require('serve-favicon')
  , bodyParser = require('body-parser')
  , exprSession = require('express-session')
  , passport = require('passport')
  , flash = require('connect-flash')


var Users = mongoose.model('Users')

// Refresh challenge cron job
var job = new cron(MACRO.CRON.CHALLENGE, function(){
    core.refresh_challenges();
  }, function () {}, true, false
);
// Refresh information about repos
var job = new cron(MACRO.CRON.CHALLENGE, function(){
    core.update_repo_info();
  }, function () {}, true, false
);


// Configuring Passport
require('./auth')(app, passport);

app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(flash())
app.use(bodyParser.json())
app.set('admin', MACRO.SUPERUSER);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(favicon(__dirname + "/public/images/rc-logo.ico"));
app.use(express.static(__dirname + '/public'));
app.use(exprSession({
  secret            : global.config.redis_secret,
  resave            : true,
  saveUninitialized : true,
  cookie: {
    secure: false,
    maxAge: 1800000 //30 min
  }
}));
app.use(passport.initialize());
app.use(passport.session());


// GITHUB LOGIN
app.get('/auth/github',
  passport.authenticate('github', {
    scope : 'email'
  })
);
app.get('/auth/github/callback',
  passport.authenticate('github', {
      successRedirect : '/login',
      failureRedirect : '/login'
  })
);
app.get('/logout', function(req, res) {
  req.logout()
  res.redirect('/')
});

// WIKIMEDIA CONNECTION
app.get('/connect/wikimedia',
  passport.authenticate('mediawiki', {
    scope : 'email'
  })
);
app.get('/auth/gerrit',
  passport.authenticate('mediawiki', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/login');
  });

// Auto login with dummy user in development if 'login' argument is provided
app.use(function (req, res, next) {
  if (req.app.get('env') == 'development' && process.argv[2] == 'login' && !req.user) {
    username = process.argv[3] || 'dev_user'
    userid = parseInt(username, 36)
    core.add_user(userid, username, generate_session)

    function generate_session(err, user) {
      req.login(user, function(err) {
        return next();
      });
    }
  } else {
    return next();
  }
});


// routes defined here
var other = require('./routes/other.js');
app.get('/', other.index);
app.get('/login', other.login);
app.get('/login/:user', other.login);
app.get('/faq', other.faq);
app.get('/guidelines', other.guidelines);
app.get('/contact', other.contact);
app.post('/contact', other.feedback);

var profile = require('./routes/profile.js');
app.get('/:user/notifications', profile.notifications)

var challenge = require('./routes/challenge.js');
app.get('/challenges', challenge.index);
app.get('/challenges/:ch', challenge.one);
app.get('/challenges/:ch/admin', challenge.one);
app.post('/challenges/:ch/edit', challenge.edit);
app.post('/challenges/:ch/rate', challenge.rate);
app.post('/challenges/:ch/admin_add', ensureAuth, challenge.admin_add);
app.post('/challenges/:ch/email_users', ensureAuth, challenge.email_users);
app.post('/challenges/:ch/update_formulae', ensureAuth, challenge.update_formulae);
app.get('/challenges/:ch/admin_remove', ensureAuth, challenge.admin_remove);
app.get('/challenges/:ch/repo_remove', ensureAuth, challenge.repo_remove);
app.get('/challenges/:ch/users', challenge.one);
app.get('/challenges/:ch/pulls', challenge.one);
app.get('/challenges/:ch/join', ensureAuth, challenge.join);
app.get('/challenges/:ch/refresh', ensureAuth, challenge.refresh);
app.get('/challenges/:ch/hide_commit', ensureAuth, challenge.hide_commit);
app.get('/challenges/:ch/display_commit', ensureAuth, challenge.display_commit);
app.get('/challenges/:ch/results', challenge.one);
app.get('/challenges/:ch/update_results', ensureAuth, challenge.update_results);
app.post('/challenges/:ch/blacklist_user', ensureAuth, challenge.blacklist_user);
app.get('/challenges/:ch/unblacklist_user', ensureAuth, challenge.unblacklist_user);


var admin = require('./routes/admin.js');
app.get('/admin', ensureSuper, admin.index);
app.post('/admin/challenge_add', ensureSuper, admin.challenge_add);

/*
This handles all other URLs.
It's main porpose is to serve /user pages and all subpages
but also send 404 response if user does not exist.
*/
app.use(profile.index);


// Make sure user is authenticated middleware
function ensureAuth(req, res, next) {
  if (req.user) return next();
  res.redirect('/login');
}

// Make sure user is authenticated and root middleware
function ensureSuper(req, res, next) {
  if (req.user && MACRO.SUPERUSER.indexOf(req.user.user_name) > -1)
    return next();

  return res.render('404', {title: "404: File not found"});
}

// Launch server
app.listen(process.env.PORT || 3000, function() {
  console.log('Server listening on port 3000.');
});
