# ROSEdu Challenge

## Setup

### Easy install
For a quick setup, just run **make setup** in the root directory.
Then **make run** will start the db and app at
[http://localhost:3000](http://localhost:3000).

### Manual setup
1. Install nodejs (preferably from own repo) and npm:

        add-apt-repository ppa:chris-lea/node.js && apt-get update
        apt-get install nodejs

2. Install mongodb. Needed for our database:

        apt-get install mongodb

3. Set node environment ($NODE_ENV):

        NODE_ENV=development

4. Install all node modules. A list is available further down.

        npm install

5. Start mongod and import testing database:

        mongod &
        mongorestore -d rosedu-challenge rchallenge_db/rosedu-challenge

6. Run mongod and start the app. Then visit [http://localhost:3000](http://localhost:3000).

        mongod &
        node app.js


## Development

To run the app in development use the corresponding Makefile target

        make run

This will launch the app using [nodemon](http://nodemon.io/) which automatically
restarts the app when you make changes to the code.


### Happy coding !
