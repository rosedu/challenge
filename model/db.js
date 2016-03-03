var mongoose = require( 'mongoose' );
var Schema   = mongoose.Schema;

var Users = new Schema({
  user_id:         String,
  user_name:       String,
  user_fullname:   String,
  user_email:      String,
  email_pub:       {type: Boolean, default: true},
  avatar_url:      String,
  location:        String,
  location_pub:    {type: Boolean, default: true},
  followers_no:    {type: Number, default: 0},
  following_no:    {type: Number, default: 0},
  join_github:     {type: String, default: Date.now},
  join_us:         {type: Date, default: Date.now},
  last_seen:       {type: Date, default: Date.now},
  unread:          {type: Boolean, default: false},
});

var Notifications = new Schema({
  src:  String,
  dest: String,
  type: String,
  seen: {type: Boolean, default: false},
  date: {type: Date, default: Date.now},
  link: {type: String, default: null},
  msg:  {type: String, default: null}
});

var Pulls = new Schema({
  _id:             Schema.Types.ObjectId,
  repo:            String,
  auth:            String,
  hide:            {type: Boolean, default: false},
  url:             {type: String, default: null},
  title:           {type: String, default: null},
  created:         {type: Date, default: null},
  merged:          {type: Date, default: null},
  rating:          {type: Number, default: 0},
  score:           {type: Number, default: 0},
  lines_inserted:  {type: Number, default: 0},
  lines_removed:   {type: Number, default: 0},
  files_changes:   {type: Number, default: 0}
});

var Challenges = new Schema({
  name:           {type: String, unique : true},
  status:         {type: String, default: "tease"},
  link:           {type: String, default: null},
  email:          {type: String, default: ""},
  logo:           {type: String, default: ""},
  repos:          {type: [String], default: []},
  about:          {type: String, default: ""},
  description:    {type: String, default: ""},
  start:          {type: Date, default: null},
  end:            {type: Date, default: null},
  refresh:        {type: Date, default: null},
  formulae:       {type: String, default: ""},
  display_scores: {type: Boolean, default: false},
  users:          {type:[String], default: []},
  blacklist:      {type: [String], default: []},
  admins:         [String],
  pulls:          [Pulls]
});

var Results = new Schema({
  auth:        String,
  total:       Number,
  challenge:   Schema.Types.ObjectId,
});

var Repo = new Schema({
  name:        String,
  description: String,
  link:        String,
});

mongoose.model('Users', Users);
mongoose.model('Notifications', Notifications);
mongoose.model('Challenges', Challenges);
mongoose.model('Pulls', Pulls);
mongoose.model('Results', Results);
mongoose.model('Repo', Repo);

mongoose.connect( 'mongodb://localhost/rosedu-challenge' );
