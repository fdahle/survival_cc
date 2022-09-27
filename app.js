//required packages
const express = require('express') //basic package required for node.js
const http = require('http'); //basic package required for node.js
const rp = require('request-promise'); //to parse websites
const cheerio = require('cheerio'); //to filter html content
const fs = require('fs'); //to read and write files
var bodyParser = require('body-parser') //to read the body of requests

//use express
const app = express()
app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true }))  // to support URL-encoded bodies

//set host and port
const hostname = '127.0.0.1';
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

//set debug mode
const debug = true

// use the files for the webapp
app.use(express.static('app'))

//write on which port the app is listening
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});

app.post('/get_settings', async function(req, res) {

  settings_arr = {
    "min_year_for_season": 2019,
    "max_year_for_season": 2022
  }

  res.send(settings_arr);

});

app.post('/get_season', async function(req, res) {

  //get the year from the request
  let year = req.body.year;

  //get the runs from the website
  let season_arr = await parse_calendar(year);

  //add the static info to the runs (coords, association, etc..)
  season_arr = await add_static_run_info(season_arr)

  //send back to server
  res.send(season_arr);

});

app.post('/get_run', async function(req, res) {

  //get the year from the request
  let run_id = req.body.run_id;

  //get the runs from the website
  let run_arr = await parse_run(run_id);

  res.send(run_arr);
});

function parse_calendar(year) {

  const url = "https://www.uvponline.nl/uvponlineU/index.php/uvproot/wedstrijdschema/" + String(year)

  return new Promise(resolve => {

    //get the html from the website
    rp(url)

      //success!
      .then(function(html) {

        //this dict will contain all runs
        var season_arr = {};

        //to select the right iso day
        days = ["su", "mo", "tu", "we", "th", "fr", "sa"];

        //load the html in cheerio, so that it can be parsed
        const $ = cheerio.load(html);

        //iterate through the table
        $("#agenda_content > div.large > div > table > tbody > tr", html).each((index, run) => {

          //skip first tr -> just the table header
          if (index == 0) {
            return
          }

          // this arr will contain all attributes of a run
          var run_obj = {};

          // sometimes estaffete is not in the distance but in the city name -> we need to catch this with a boolean
          var bool_run_is_estaffete = false;

          //there can be multiple klassements per run -> define a list before
          run_obj["categories"] = [];

          //try, so that if something went wrong we still can get the other runs
          try {

            //iterate all attributes of the run
            $(run).children().each((run_index, run_attr) => {

              //append to the object
              if (run_index == 0) { //date

                run_obj["date"] = $(run_attr).text();

              } else if (run_index == 1) { //Name of the city

                var city = $(run_attr).text();

                //remove leading whitespace
                city = city.trimStart();

                if (city.toLowerCase().includes("estafette") || city.toLowerCase().includes("estaffete")){
                  bool_run_is_estaffete = true;
                }

                //we need to edit the city a little bit, as they added extra info
                if (city.startsWith("AFGELAST")) {
                  city = city.slice(9);
                  run_obj["cancelled"] = true;
                } else {
                  run_obj["cancelled"] = false;
                }

                city = city.replace(" ONK", "");
                city = city.replace("ONK ", '')

                city = city.replace(" NSK", "");
                city = city.replace("NSK ", "");

                city = city.replace(" LSR", "");
                city = city.replace("LSR ", "");

                city = city.replace(" MSR", "");
                city = city.replace("MSR ", "");

                city = city.replace(" KSR", "");
                city = city.replace("KSR ", "");

                city = city.replace(" JSR", "");
                city = city.replace("JSR ", "");

                city = city.replace(" Koppel", "");
                city = city.replace("Koppel ", "");

                //remove all stuff after the brackets (just extra info we don't need)
                city = city.split(' (')[0];

                //remove all stuff after a -
                city = city.split(" - ")[0];

                //remove even more leading whitespace
                city = city.trimStart();

                //set city
                run_obj["city"] = city;

                //every city has recr -> add it
                run_obj["categories"].push("recr")


              } else if (run_index == 2) { // categories: LSR

                if ($(run_attr).text().includes("L")) {
                  run_obj["categories"].push("L")
                }

              } else if (run_index == 3) { // Klassement: MSR

                if ($(run_attr).text().includes("M")) {
                  run_obj["categories"].push("M")
                }


              } else if (run_index == 4) { // Klassement: KSR

                if ($(run_attr).text().includes("K")) {
                  run_obj["categories"].push("K")
                }

              } else if (run_index == 5) { // Klassement: JSR

                if ($(run_attr).text().includes("J")) {
                  run_obj["categories"].push("J")
                }

              } else if (run_index == 6) { // Klassement: BSR

                if ($(run_attr).text().includes("B")) {
                  run_obj["categories"].push("B")
                }

              } else if (run_index == 7) { // Kwalifikatierun

                if ($(run_attr).text().includes("KWALIFICATIERUN")) {
                  run_obj["qualification_run"] = true
                } else {
                  run_obj["qualification_run"] = false
                }

              } else if (run_index == 8) { // Afstanden

                run_obj["distances"] = []

                var distances = $(run_attr).text();
                distances = distances.toLowerCase();
                distances = distances.replace(" km", "");
                distances = distances.replace(" en ", " - ")
                distances = distances.replace(", ", " - ")

                //check for estaffete
                if (bool_run_is_estaffete == true || distances.includes("estaffete") || distances.includes("estafette")){
                  run_obj["distances"].push("estaffete");
                } else {
                  let splits = distances.split(' - ');
                  for (var i = 0; i < splits.length; i++) {
                    let distance = splits[i];
                    distance = distance.replace(",", ".")
                    distance = parseFloat(distance)
                    run_obj["distances"].push(distance)
                  };
                }

                if (isNaN(run_obj["distances"][0]) && run_obj["distances"][0] != "estaffete"){
                  run_obj["distances"] = [];
                }

              } else if (run_index == 9) { // leeftijd

                let splits = $(run_attr).text().split(' ');
                let age = parseInt(splits[1]);
                run_obj["minimum_age"] = age;


              } else if (run_index == 10) { // Organisator

                let organisator = $(run_attr).text();
                organisator = organisator.trimEnd(); //remove trailing whitespace
                run_obj["organisator"] = organisator;

                //get the hyperlink
                let href = $(run_attr).find("a").attr("href");

                //backup if something goes wrong
                if (href == undefined) {
                  run_obj["hyperlink"] = ""

                  //yes, we got a hyperlink
                } else {
                  run_obj["hyperlink"] = href
                }


              } else if (run_index == 11) { // Inschrijflink

                //get the hyperlink
                let href = $(run_attr).find("a").attr("href");

                //backup if something goes wrong
                if (href == undefined) {
                  run_obj["subscription_id"] = "";
                  run_obj["subscription_link"] = ""

                  //yes, we got a hyperlink
                } else {
                  let splits = href.split('/');
                  let run_id = parseInt(splits[splits.length - 1]);
                  run_obj["subscription_id"] = run_id;
                  run_obj["subscription_link"] = href
                }

                run_obj["subscription_status"] = $(run_attr).text();

              } else if (run_index == 12) { // Uitslag
                let result = $(run_attr).text();

                result = result.replace(/\n/g,' ');
                result = result.trimStart();
                run_obj["result"] = result;

                //get the hyperlink
                let href = $(run_attr).find("a").attr("href");

                //backup if something goes wrong
                if (href == undefined) {
                  run_obj["result_link"] = ""
                } else {
                  run_obj["result_link"] = href
                }

              }

            });

            //create the key for this run
            let key = run_obj["city"]

            //ALV is not a run -->remove
            if (key.startsWith("ALV")) {
              return
            }

            //to create the key we need to make it a single word
            key = key.replace("'", '');
            key = key.replace(" ", "_");
            key = key.replace("-", "_");
            key = key.toLowerCase();


            //three options:
            // - key not already in there, normal stuff
            // - key already in, but same organisator -> same run on different days
            // - key already in there, different organistator -> different run in same city
            if (Object.keys(season_arr).indexOf(key) == -1) {
              season_arr[key] = run_obj;
            } else if (Object.keys(season_arr).indexOf(key) != -1 && (season_arr[key]["organisator"] == undefined || season_arr[key]["organisator"] == run_obj["organisator"])) {

              //we do not have an extra layer for days yet
              if (season_arr[key]["organisator"] != undefined) {

                //get temporary the object
                let temp = season_arr[key];

                //create new extra layer
                season_arr[key] = {};

                //get weekday for this temp obj
                let dateParts = temp["date"].split("-");
                let date = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]);
                var weekday_short = days[date.getDay()]

                //save temp object
                season_arr[key][weekday_short] = temp;
              }

              let dateParts = run_obj["date"].split("-");
              let date = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]);
              var weekday_short = days[date.getDay()]
              season_arr[key][weekday_short] = run_obj;

            } else if (Object.keys(season_arr).indexOf(key) != -1 && season_arr[key]["organisator"] != run_obj["organisator"]) {

              //check if key already in season_array
              counter = 1;
              while (Object.keys(season_arr).indexOf(key) != -1) {
                key = key + "_" + counter.toString();
                counter = counter + 1
              }

              season_arr[key] = run_obj
            }


            //if something went wrong print the error
          } catch (e) {
            console.log(e);
          }

        });

        //remove ultra survial run
        // skip ultra survivalrun

        delete season_arr['ultra_survivalrun'];

        resolve(season_arr)

      })

      //handle error
      .catch(function(err) {
        console.log("An error happend when parsing the html for a season");
        var season_arr = {}
        resolve(season_arr)
      });
  });
}

function add_static_run_info(season_arr) {

  //read json_file
  let rawdata = fs.readFileSync('data/static_run_info.json');
  let static_run_data = JSON.parse(rawdata);

  return new Promise(resolve => {
    try {

      //iterate season_arr dict to get the keys
      for (var key in season_arr) {

        //check the first key in the season_arr (for runs on multiple days)
        if (Object.keys(season_arr[key])[0] != "categories") {
          var bool_multiday_run = true;
        } else {
          var bool_multiday_run = false;
        }

        //check if this run exists in the static run data
        if (static_run_data[key] != undefined) {
          //iterate all attributes
          for (_key in static_run_data[key]) {
            if (bool_multiday_run == true) {
              for (var weekday of Object.keys(season_arr[key])) {
                season_arr[key][weekday][_key] = static_run_data[key][_key];
              }
            } else {
              season_arr[key][_key] = static_run_data[key][_key];
            }
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
    resolve(season_arr);
  });
}

function parse_run(run_id) {
  let hyperlink = "https://www.uvponline.nl/uvponlineF/inschrijven_overzicht/" + run_id

  return new Promise(resolve => {
    //get the html from the website
    rp(hyperlink)

      //success!
      .then(function(html) {

        //load the html in cheerio, so that it can be parsed
        const $ = cheerio.load(html);

        var all_categories_arr = []

        $(".cat_overzicht", html).each((index, run_cat) => {

          var category_arr = {}

          //iterate all attributes of the run
          $(run_cat).children().each((run_cat_index, run_cat_attr) => {

            if (run_cat_index == 0) { //noting in there, perhaps at a later stage

              return

            } else if (run_cat_index == 1){ //number of people

              let numbers_str = $(run_cat_attr).text();

              let registered_participants = numbers_str.split("max")[0];
              let max_participants = numbers_str.split("max")[1];

              registered_participants = parseInt(registered_participants);
              max_participants = parseInt(max_participants);

              category_arr["participants_registered"] = registered_participants;
              category_arr["participants_max"] = max_participants;

            } else if (run_cat_index == 2){ //category full

              let cat_full_str = $(run_cat_attr).text();

            } else if (run_cat_index == 3){ //category description

              let run_cat_desc_str = $(run_cat_attr).text();
              run_cat_desc_str = run_cat_desc_str.toLowerCase();

              let run_href = $(run_cat_attr).find("a").attr("href");

              let distance = undefined;
              let run_type = undefined;
              let run_difficulty = undefined;
              let run_category = undefined;

              //make km right
              if (run_cat_desc_str.includes(" km")){
                run_cat_desc_str = run_cat_desc_str.replace(' km', 'km');
              }

              for (var substr of run_cat_desc_str.split(" ")){

                //get distance
                if (substr.includes("km")){
                  distance = substr.slice(0, -2);
                  run_cat_desc_str = run_cat_desc_str.replace('.', ',');
                  distance = parseFloat(distance);
                }

                //get run_type
                if (substr.includes("team") || substr.includes("groep")){
                  run_type = "team";
                } else if (substr.includes("koppel")){
                  run_type = "duo";
                } else if (substr.includes("solo") || substr.includes("individueel")){
                  run_type = "solo";
                } else if (substr.includes("ouder-kind") || substr.includes("ouder kind") ||
                           substr.includes("family" || substr.includes("kids"))){
                  run_type = "family";
                }

                //get run_category
                if (substr.includes("recrea") || substr.includes("fun") || substr.includes("student")){
                  run_category = "recreational"
                } else if (substr.includes("jsr") || substr.includes("jeugd")){
                  run_category = "jsr";
                } else if (substr.includes("ksr")){
                  run_category = "ksr";
                } else if (substr.includes("lsr")){
                  run_category = "lsr";
                } else if (substr.includes("bsr")){
                  run_category = "bsr";
                } else if (substr.includes("msr")){
                  run_category = "msr";
                }

                //get run_type
                if (substr.includes("zwaar") || substr.includes("lsr")){
                  run_difficulty = "difficult";
                } else if (substr.includes("licht") || substr.includes("fun")){
                  run_difficulty = "easy";
                }

              }

              category_arr["astring"] = run_cat_desc_str;
              category_arr["distance"] = distance;
              category_arr["run_type"] = run_type;
              category_arr["run_difficulty"] = run_difficulty;
              category_arr["run_category"] = run_category;
              category_arr["href"] = run_href;

            }

          });


          all_categories_arr.push(category_arr);

        });

        resolve(all_categories_arr);

      })

      //handle error
      .catch(function(err) {
        console.log("An error happend when parsing the html for a run");
        console.log(err);
        var all_categories_arr = {}
        resolve(all_categories_arr)
      });

  });
}
