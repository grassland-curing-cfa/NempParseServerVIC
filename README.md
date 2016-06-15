# parse-server-example

Example project using the [parse-server](https://github.com/ParsePlatform/parse-server) module on Express.

Read the full Parse Server guide here: https://github.com/ParsePlatform/parse-server/wiki/Parse-Server-Guide

### Prepare for multiple local and GitHub repositories for multiple Parse-server-example instances

* Clone the original Parse-server-example project using the [parse-server](https://github.com/ParsePlatform/parse-server) to a local directory where you want to store the potential repositories, e.g. "C:\Work\tmp\"

  git clone https://github.com/ParsePlatform/parse-server-example parse-server-example-app1
  
  Cloning into 'parse-server-example-app1'...
  
  remote: Counting objects: 135, done.
  
  remote: Compressing objects: 100% (19/19), done.
  
  remote: Total 135 (delta 10), reused 0 (delta 0), pack-reused 116
  
  Receiving objects: 100% (135/135), 29.00 KiB | 0 bytes/s, done.
  
  Resolving deltas: 100% (61/61), done.
  
  Checking connectivity... done.
  
* Change the current working directory to your local project, e.g. "C:\Work\tmp\parse-server-example-app1\".

* Go back to GitHub under your own account

* Create a new repository and name it "parse-server-example-app1" on GitHub; this repository will host the code for the cloned repository locally as above steps

  URL to the new repository on GitHubhttps://github.com/grassland-curing-cfa/parse-server-example-app1.git

* Now let's push the cloned local repository to the GitHub repository by running the following commands. Reference document: http://stackoverflow.com/questions/1221840/remote-origin-already-exists-on-git-push-to-a-new-repository

* git remote -v

  This shows the current URLs for both "fetch" and "push" for the current "origin"; they should now still be connected to "https://github.com/ParsePlatform/parse-server-example"
  
* git remote rm origin

  This should disconnect from the old repository "https://github.com/ParsePlatform/parse-server-example"
  
* git remote add origin https://github.com/grassland-curing-cfa/parse-server-example-app1.git

  This should connect to the new repository that was newly created as above.
  
* git push -u origin master

  This should push the cloned repository locally to the new remote repository on GitHub. Enter Username and Password for your GitHub account.
  
  Counting objects: 133, done.

  Delta compression using up to 4 threads.

  Compressing objects: 100% (69/69), done.

  Writing objects: 100% (133/133), 28.72 KiB | 0 bytes/s, done.

  Total 133 (delta 61), reused 133 (delta 61)

  To https://github.com/grassland-curing-cfa/parse-server-example-app1.git

  * [new branch]      master -> master

  Branch master set up to track remote branch master from origin.

* Update package.json
  Update "name", "description", "repository""url",
  add "underscore": "~1.8.3",
      "cors": "*"
  to "dependencies"

* Update index.js

  Add "var cors = require('cors');"
      after "var express = require('express');"
  
  Add "restAPIKey: process.env.REST_API_KEY || '',
      javascriptKey: process.env.JAVASCRIPT_KEY || '',
      serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',"
      to ParseServer constructor
      
  Add "app.use(cors());" after "var app = express();".

* Push the changes to the remote repository

  Ensure current working directory to your local project, e.g. "C:\Work\tmp\parse-server-example-app1\".
  
  git add .
  
  git commit -am "updated package.json and index.js files as initial checkin"
  
  git push origin master

### Deploy a Parse-server-example on Heroku

* Log in Heroku Web Admin, go to "Personal apps"
* Add a new app with new name "nemp-{state}-test"
* Go to Settings and specify the following Config Variables:
  APP_ID, APP_NAME, JAVASCRIPT_KEY, MASTER_KEY, MONGODB_URI(or MONGOLAB_URI), PARSE_MOUNT, REST_API_KEY, SERVER_URL, SUPER_USER, SUPER_USER_PASS
* Go to Deploy and click "GitHub" as the Deployment method
* Connect to the remote GitHub repository that was set up in the previous setps: "https://github.com/grassland-curing-cfa/NempParseServer{state}"
* Click Connect and select the Master branch for deployment
* Enable Automatic Deployment
* Click Deploy Branch
* Test the app

----------------------------------------------------------------------------------------------------------------------------

### For Local Development

* Make sure you have at least Node 4.3. `node --version`
* Clone this repo and change directory to it.
* `npm install`
* Install mongo locally using http://docs.mongodb.org/master/tutorial/install-mongodb-on-os-x/
* Run `mongo` to connect to your database, just to make sure it's working. Once you see a mongo prompt, exit with Control-D
* Run the server with: `npm start`
* By default it will use a path of /parse for the API routes.  To change this, or use older client SDKs, run `export PARSE_MOUNT=/1` before launching the server.
* You now have a database named "dev" that contains your Parse data
* Install ngrok and you can test with devices

### Getting Started With Heroku + mLab Development

#### With the Heroku Button

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

#### Without It

* Clone the repo and change directory to it
* Log in with the [Heroku Toolbelt](https://toolbelt.heroku.com/) and create an app: `heroku create`
* Use the [mLab addon](https://elements.heroku.com/addons/mongolab): `heroku addons:create mongolab:sandbox --app YourAppName`
* By default it will use a path of /parse for the API routes.  To change this, or use older client SDKs, run `heroku config:set PARSE_MOUNT=/1`
* Deploy it with: `git push heroku master`

### Getting Started With AWS Elastic Beanstalk

#### With the Deploy to AWS Button

<a title="Deploy to AWS" href="https://console.aws.amazon.com/elasticbeanstalk/home?region=us-west-2#/newApplication?applicationName=ParseServer&solutionStackName=Node.js&tierName=WebServer&sourceBundleUrl=https://s3.amazonaws.com/elasticbeanstalk-samples-us-east-1/eb-parse-server-sample/parse-server-example.zip" target="_blank"><img src="http://d0.awsstatic.com/product-marketing/Elastic%20Beanstalk/deploy-to-aws.png" height="40"></a>

#### Without It

* Clone the repo and change directory to it
* Log in with the [AWS Elastic Beanstalk CLI](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install.html), select a region, and create an app: `eb init`
* Create an environment and pass in MongoDB URI, App ID, and Master Key: `eb create --envvars DATABASE_URI=<replace with URI>,APP_ID=<replace with Parse app ID>,MASTER_KEY=<replace with Parse master key>`

### Getting Started With Microsoft Azure App Service

#### With the Deploy to Azure Button

[![Deploy to Azure](http://azuredeploy.net/deploybutton.png)](https://azuredeploy.net/)

#### Without It

A detailed tutorial is available here:
[Azure welcomes Parse developers](https://azure.microsoft.com/en-us/blog/azure-welcomes-parse-developers/)


### Getting Started With Google App Engine

1. Clone the repo and change directory to it 
1. Create a project in the [Google Cloud Platform Console](https://console.cloud.google.com/).
1. [Enable billing](https://console.cloud.google.com/project/_/settings) for your project.
1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/).
1. Setup a MongoDB server.  You have a few options:
  1. Create a Google Compute Engine virtual machine with [MongoDB pre-installed](https://cloud.google.com/launcher/?q=mongodb).
  1. Use [MongoLab](https://mongolab.com/google/) to create a free MongoDB deployment on Google Cloud Platform.
1. Modify `app.yaml` to update your environment variables.
1. Delete `Dockerfile`
1. Deploy it with `gcloud preview app deploy`

A detailed tutorial is available here:
[Running Parse server on Google App Engine](https://cloud.google.com/nodejs/resources/frameworks/parse-server)

### Getting Started With Scalingo

#### With the Scalingo button

[![Deploy to Scalingo](https://cdn.scalingo.com/deploy/button.svg)](https://my.scalingo.com/deploy)

#### Without it

* Clone the repo and change directory to it
* Log in with the [Scalingo CLI](http://cli.scalingo.com/) and create an app: `scalingo create my-parse`
* Use the [Scalingo MongoDB addon](https://scalingo.com/addons/scalingo-mongodb): `scalingo addons-add scalingo-mongodb free`
* Setup MongoDB connection string: `scalingo env-set DATABASE_URI='$SCALINGO_MONGO_URL'`
* By default it will use a path of /parse for the API routes. To change this, or use older client SDKs, run `scalingo env-set PARSE_MOUNT=/1`
* Deploy it with: `git push scalingo master`

# Using it

Before using it, you can access a test page to verify if the basic setup is working fine [http://localhost:1337/test](http://localhost:1337/test).
Then you can use the REST API, the JavaScript SDK, and any of our open-source SDKs:

Example request to a server running locally:

```curl
curl -X POST \
  -H "X-Parse-Application-Id: myAppId" \
  -H "Content-Type: application/json" \
  -d '{"score":1337,"playerName":"Sean Plott","cheatMode":false}' \
  http://localhost:1337/parse/classes/GameScore
  
curl -X POST \
  -H "X-Parse-Application-Id: myAppId" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:1337/parse/functions/hello
```

Example using it via JavaScript:

```javascript
Parse.initialize('myAppId','unused');
Parse.serverURL = 'https://whatever.herokuapp.com';

var obj = new Parse.Object('GameScore');
obj.set('score',1337);
obj.save().then(function(obj) {
  console.log(obj.toJSON());
  var query = new Parse.Query('GameScore');
  query.get(obj.id).then(function(objAgain) {
    console.log(objAgain.toJSON());
  }, function(err) {console.log(err); });
}, function(err) { console.log(err); });
```

Example using it on Android:
```java
//in your application class

Parse.initialize(new Parse.Configuration.Builder(getApplicationContext())
  .applicationId("myAppId")
  .server("http://myServerUrl/parse/")   // '/' important after 'parse'
  .build());

ParseObject testObject = new ParseObject("TestObject");
testObject.put("foo", "bar");
testObject.saveInBackground();
```
Example using it on iOS (Swift):
```swift
//in your AppDelegate

Parse.initializeWithConfiguration(ParseClientConfiguration(block: { (configuration: ParseMutableClientConfiguration) -> Void in
  configuration.server = "https://<# Your Server URL #>/parse/" // '/' important after 'parse'
  configuration.applicationId = "<# Your APP_ID #>"
}))
```
You can change the server URL in all of the open-source SDKs, but we're releasing new builds which provide initialization time configuration of this property.
