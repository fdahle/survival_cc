//required packages
const express = require('express') //basic package required for node.js
const http = require('http'); //basic package required for node.js
const rp = require('request-promise'); //to parse websites
const cheerio = require('cheerio'); //to filter html content
const fs = require('fs'); //to read and write files

//use express
const app = express()
app.use(express.json())

//set host and port
const hostname = '127.0.0.1';
const port = process.env.PORT;
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
})

app.post('/get_runs', async function(req, res) {

  let year = 2022;

  //get the runs from the website
  let run_arr = await parse_calendar(year);

  //add the static info to the runs (coords, association, etc..)
  run_arr = await add_static_run_info(run_arr)

  //send back to server
  res.send(run_arr);

});

function parse_calendar(year) {

  //if (year == 2022){
  const url = "https://www.uvponline.nl/uvponlineU/index.php/uvproot/wedstrijdschema/2022"
  //}

  return new Promise(resolve => {

    //get the html from the website
    rp(url)

      //success!
      .then(function(html) {

        //this dict will contain all runs
        var run_arr = {}
        var lst_of_orgas = [] //just to make it easier to check for the organisation

        //load the html in cheerio, so that it can be parsed
        const $ = cheerio.load(html)

        //iterate through the table
        $("#agenda_content > div.large > div > table > tbody > tr", html).each((index, run) => {

          //skip first tr -> just the table header
          if (index == 0) {
            return
          }

          // this arr will contain all attributes of a run
          var run_obj = {};

          //some runs are split in multiple days, we need to catch it
          //we find out if a run is already existing with their website, as this is identical
          var bool_run_already_existing = false

          //there can be multiple klassements per run -> define a list before
          run_obj["klassement"] = [];

          //try, so that if something went wrong we still can get the other runs
          try {

            //iterate all attributes of the run
            $(run).children().each((run_index, run_attr) => {

              //append to the object
              if (run_index == 0) { //date

                run_obj["date"] = $(run_attr).text();

              } else if (run_index == 1) { //Name of the city

                var city = $(run_attr).text()

                //we need to edit the city a little bit, as they added extra info
                if (city.startsWith("AFGELAST")) {
                  city = city.slice(9)
                }
                city = city.split(' (')[0];
                city = city.split(' ONK')[0];
                city = city.split(' NSK')[0];


                run_obj["city"] = city;


              } else if (run_index == 2) { // Klassement: LSR

                if ($(run_attr).text().includes("L")) {
                  run_obj["klassement"].push("L")
                }

              } else if (run_index == 3) { // Klassement: MSR

                if ($(run_attr).text().includes("M")) {
                  run_obj["klassement"].push("M")
                }


              } else if (run_index == 4) { // Klassement: KSR

                if ($(run_attr).text().includes("K")) {
                  run_obj["klassement"].push("K")
                }

              } else if (run_index == 5) { // Klassement: JSR

                if ($(run_attr).text().includes("J")) {
                  run_obj["klassement"].push("J")
                }

              } else if (run_index == 6) { // Klassement: BSR

                if ($(run_attr).text().includes("B")) {
                  run_obj["klassement"].push("B")
                }

              } else if (run_index == 7) { // Kwalifikatierun

                if ($(run_attr).text().includes("KWALIFICATIERUN")) {
                  run_obj["kwal"] = true
                } else {
                  run_obj["kwal"] = false
                }

              } else if (run_index == 8) { // Afstanden

                run_obj["afstanden"] = []

                let splits = $(run_attr).text().split(' - ');
                for (var i = 0; i < splits.length; i++) {
                  let distance = splits[i];
                  if (distance.includes("KM")) {
                    distance = distance.slice(0, -3)
                  }
                  distance = parseFloat(distance)
                  run_obj["afstanden"].push(distance)
                };

              } else if (run_index == 9) { // leeftijd

                let splits = $(run_attr).text().split(' ');
                let age = parseInt(splits[1]);
                run_obj["leeftijd"] = age;


              } else if (run_index == 10) { // Organisator
                run_obj["organisator"] = $(run_attr).text();

                //check if already existing -> to check if we have this run already
                if (lst_of_orgas.includes($(run_attr).text())){

                  //run already exising
                  bool_run_already_existing = true

                } else {
                  //add to list
                  lst_of_orgas.push($(run_attr).text())

                  //run not existing
                  bool_run_already_existing = false
                }

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
                  run_obj["id"] = "";
                  run_obj["Inschrijflink"] = ""

                //yes, we got a hyperlink
                } else {
                  let splits = href.split('/');
                  let run_id = parseInt(splits[splits.length - 1]);
                  run_obj["id"] = run_id;
                  run_obj["Inschrijflink"] = href
                }

                run_obj["inschrijfstate"] = $(run_attr).text();

              } else if (run_index == 12) { // Uitslag
                run_obj["uitslag"] = $(run_attr).text();

              }

            });

            //create the key for this run
            let key = run_obj["city"]

            //ALV is not a run -->remove
            if (key.startsWith("ALV")) {
              return
            }

            key = key.replace("'", '');
            key = key.replace(" ", "_")
            key = key.replace("-", "_")

            //run not already existing
            if (bool_run_already_existing == false){

              //TODO: MAKE IT SAVE FOR MORE THAN TWO RUNS IN A CITY

              //check if key already existing (for runs in the same city)
              if (run_arr[key] != undefined){
                run_arr[key + "_1"] = run_arr[key]
                delete run_arr[key]
                key = key +"_2"
              }
              run_arr[key] = run_obj

            //run is on two different days
            } else {

                //TODO: MAKE IT SAVE FOR RUNS THAT ARE ON A WEEKDAY

                let temp = run_arr[key];
                run_arr[key] = {};
                run_arr[key]["za"] = temp;
                run_arr[key]["zo"] = run_obj;
            }


            //if something went wrong print the error
          } catch (e) {
            console.log(e);
          }

        });

        resolve(run_arr)

      })

      //handle error
      .catch(function(err) {
        console.log("An error happend when parsing the html");
        var run_arr = {}
      });
  });
}

function add_static_run_info(run_arr) {

  //read json_file
  let rawdata = fs.readFileSync('data/static_run_info.json');
  let static_run_data = JSON.parse(rawdata);

  var bool_weekend_run = false;

  return new Promise(resolve => {

    //iterate run_arr dict to get the keys
    for (var key in run_arr) {

      //check the first key in the run_arr (for runs on multiple days)
      if (Object.keys(run_arr[key])[0] == "za"){
        bool_weekend_run = true
      } else {
        bool_weekend_run = false
      }


      //check if this run exists in the static run data
      if (static_run_data[key] != undefined)

        //iterate all attributes
        for (_key in static_run_data[key]) {

          //add the static run data to the run data
          if (bool_weekend_run){
            run_arr[key]["za"][_key] = static_run_data[key][_key];
            run_arr[key]["zo"][_key] = static_run_data[key][_key];
          }else{
            run_arr[key][_key] = static_run_data[key][_key];
          }
        }
    }
    resolve(run_arr);
  });
}

function parse_run(run_id){

  let hyperlink = "https://www.uvponline.nl/uvponlineF/inschrijven_overzicht/" + run_id



}
