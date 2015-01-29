setup: package.json
	sudo add-apt-repository ppa:chris-lea/node.js -y
	sudo apt-get update
	sudo apt-get install nodejs -y
	npm config set registry http://registry.npmjs.org/
	sudo npm install

	sudo port install mongodb || sudo apt-get install mongodb
	NODE_ENV=development

	mongod &
	mongorestore -d rosedu-challenge rchallenge_db/rosedu-challenge
	killall mongod

setup-rpm: package.json
	sudo yum install -y nodejs npm
	npm config set registry http://registry.npmjs.org/
	sudo npm install

	sudo yum install -y mongo-org
	NODE_ENV=development

	mongod &
	mongorestore -d rosedu-challenge rchallenge_db/rosedu-challenge
	killall mongod

test:
	@for t in $$(ls tests); do \
		./node_modules/.bin/mocha -R spec tests/$$t; \
	done

run:
	@mongod &
	@./node_modules/nodemon/bin/nodemon.js app.js $(user)

production:
	@export NODE_ENV=production
	nohup node app.js &> app.log

deploy:
	ssh challenge@projects.rosedu.org /home/challenge/deploy.sh

db-export:
	rm -rf rchallenge_db
	mongod &
	mongodump -d rosedu-challenge -o rchallenge_db

db-import:
	mongod &
	mongorestore -d rosedu-challenge rchallenge_db/rosedu-challenge

db-drop:
	mongod &
	mongo rosedu-challenge --eval "db.dropDatabase();"
