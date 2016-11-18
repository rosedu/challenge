// DOCS: https://gerrit-review.googlesource.com/Documentation/rest-api-changes.html#list-changes
// ENDPOINT: https://gerrit.wikimedia.org/r/changes

var https      = require('https');

var options = {
  host: "gerrit.wikimedia.org",
  path: "/r/changes/",
  method: "GET",
  //headers: { "User-Agent": "github-connect" }
};

var request = https.request(options, function(response){
  var body = '';
  //console.log(response)

  response.on("data", function(chunk){
    body+=chunk.toString("utf8");
  });

  response.on("end", function(){
    // Remove junk from the begining of response
    var pulls = JSON.parse(body.substring(5));
    for (var p in pulls) {
      //console.log(pulls[p].owner._account_id)
      if (pulls[p].owner._account_id == 136) {
        console.log(pulls[p])
        console.log('URL: https://gerrit.wikimedia.org/r/#/c/' + pulls[p]._number)
      }
    }
    //console.log(pulls)
  });
});

request.end();
