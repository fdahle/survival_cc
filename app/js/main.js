'use strict';

//global variables
var map; //the leaflet map
var iconsArr = {}; //contains the leaflet icons
var markerArr = {} //contains the markers on the leaflet
var db; //contains the indexedDB

//main function that is called when opening the site
async function init_page() {

  //show the loader
  document.getElementById("div_loader").classList.remove("hidden");

  //remove the nojs warning and show the elements
  document.getElementById("div_warning_message").classList.add("hidden");
  document.getElementById("div_season_picker").classList.remove("hidden");
  document.getElementById("div_hamburger").classList.remove("hidden");
  document.getElementById("div_searchbar").classList.remove("hidden");
  document.getElementById("div_question").classList.remove("hidden");

  //set right pos (for menus)
  set_pos_of_elements();

  //create the map
  await init_map();

  //create the icons
  await init_icons();

  //init the database
  db = await init_DB();

  //init the settings in db and set their default values
  await init_settings();
  await set_default_settings()

  // set the values of some html elements
  await set_html_css_values();

  //check if we should hide the legend site
  var show_legend = await db_get_data('show_legend', 'settings');
  show_legend = show_legend.settings_val;
  if (show_legend == true) {
    document.getElementById("div_legend").classList.remove("hidden");
    document.getElementById("div_overlay").classList.remove("hidden");
    set_pos_of_elements();
  } else {
    document.getElementById("check_no_show_legend").checked = true;
  }

  //get the season
  let selected_season = await db_get_data("selected_season", "settings");
  selected_season = selected_season.settings_val;

  //get the runs and save to db
  let bool_success_get_season = await get_season(selected_season);
  if (bool_success_get_season) {
    //set the markers on the map
    await set_markers_and_popups();

    //init filters in db and filter for runs (if we have preexisting filters)
    await init_filters();
    filter_runs();
  }

  //hide the loader
  document.getElementById("div_loader").classList.add("hidden");

  //add event listener to resize
  window.addEventListener('resize', function(event) {
    set_pos_of_elements();
  }, true);

}

//function to create the initial map with all settings
function init_map() {

  // TODO: Make to positiion button and not automatically

  // create the map
  map = L.map('div_map');

  // add osm
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  //set to default view
  map.setView([52.3378430244975, 5.4270294217018655], 8);

  //gets executed everytime we open a marker popup
  map.on('popupopen', async function(e) {

    //get marker and run_id
    let marker = e.popup._source;
    let run_id = marker.run_id;

    let run_data = await get_run(run_id);
    fill_popup_table(run_data, e.popup)
  });


  // ask for geolocation
  //if (window.navigator.geolocation) {
  //  navigator.geolocation.getCurrentPosition(thisPos)

  //  function thisPos(position) {
  //    map.setView([position.coords.latitude, position.coords.longitude], 11)
  //  }
  //}
}

//create the different coloured icons
function init_icons() {
  var greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  iconsArr["green"] = greenIcon

  var redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  iconsArr["red"] = redIcon

  var blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  iconsArr["blue"] = blueIcon

  var grayIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  iconsArr["gray"] = grayIcon

  var orangeIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  iconsArr["orange"] = orangeIcon


}

//get all runs (date, name, info, location for a season)
function get_season(selected_season) {

  return new Promise(async (resolve, reject) => {

    //the season consists of two years in the format 20xx/20xx, but we only need the first year
    let first_year_of_season = selected_season.split("/")[0];

    //should not happen, but catch an undefined seasons so that we are not calling the server
    if (first_year_of_season == undefined) {
      resolve(false);
    }

    //get the last sync_date of the data in the db
    let season = await db_get_data(selected_season, "seasons");

    //get age of the data
    if (season != undefined) {

      //get the maximum allowed sync age for runs
      var max_sync_age = await db_get_data("runs_maximum_age", "settings");
      max_sync_age = max_sync_age.settings_val;

      //check how recent is the data we have
      var run_age = new Date() - season.sync_date;

      //if the last time we got the data is too recent, stop the rest of the funcion
      //as we have recent data and we can just continue
      if (run_age < max_sync_age) {
        resolve(true)
      }
    }

    //get the data from server
    var run_params = {
      "year": first_year_of_season
    }
    var season_data = await get_data_from_server('get_season', run_params);

    if (season_data != undefined) {

      //create js object per season
      var seasonObj = {
        "season": selected_season,
        "data": season_data,
        "sync_date": new Date()
      }

      //add this data to the indexedb
      await db_add_data(selected_season, seasonObj, "seasons")

      //function was achieved successfully -> go back to main
      resolve(true);

    } else {
      window.alert("Something went wrong getting the run data for " + selected_season + ". Please try again later.");
      resolve(false);
    }

    //if nothing worked, at least we go back to the main thread
    resolve(false)
  });

}

//get the data from a server for a particular run (run categories and participants)
async function get_run(run_id) {

  return new Promise(async (resolve, reject) => {

    //the parameters must be send as an arrays
    var run_params = {
      "run_id": run_id
    }
    var run_data = await get_data_from_server('get_run', run_params);

    resolve(run_data)
  });
}

//with this function we fill the table of a run popup (if you click on a marker with content)
function fill_popup_table(run_data, popup) {

  //get the wrapper & loader element
  var table_wrapper = popup._container.children[0].children[0].children[0].children[2].children[8];
  var div_wrapper_loader = table_wrapper.nextSibling;

  // if we have no data we hide the table and that's it
  if (run_data == undefined || run_data.length == 0) {
    table_wrapper.classList.add("hidden");
    div_wrapper_loader.classList.add("hidden");
    return
  } else {
    table_wrapper.classList.remove("hidden");
    div_wrapper_loader.classList.remove("hidden");
  }

  //set the width for the table
  var table_width = table_wrapper.previousSibling.offsetWidth;
  table_wrapper.style.width = table_width + "px";

  //don't fill the table again
  if (table_wrapper.childElementCount > 0) {
    console.log("MAKE REFRESHING AND SYNC DATE");
    div_wrapper_loader.classList.add("hidden");
    return
  }

  //create the table head
  var thead = document.createElement("thead");
  var tr_header = document.createElement("tr");

  //create table head category
  var th_cat = document.createElement("th");
  th_cat.setAttribute("order_direction", "normal")
  th_cat.classList.add("col_category");
  th_cat.innerHTML = "Category" + " <i class='fa fa-blank'></i>";
  let adapted_width = table_width - 80 - 6 - 15;
  th_cat.style.width = adapted_width + "px";
  th_cat.addEventListener("click", function(e) {
    e.stopPropagation(); //required as otherwise leaflet throws an error
    order_table("category", table_wrapper);
  });
  tr_header.appendChild(th_cat);

  //create table head registered participants
  var th_registered = document.createElement("th");
  th_registered.setAttribute("order_direction", "normal")
  th_registered.classList.add("col_registered");
  th_registered.innerHTML = "reg" + " <i class='fa fa-blank'></i>";
  th_registered.addEventListener("click", function(e) {
    order_table("reg", table_wrapper);
  });
  tr_header.appendChild(th_registered);

  //create table head max participants
  var th_max = document.createElement("th");
  th_max.setAttribute("order_direction", "normal")
  th_max.classList.add("col_max");
  th_max.innerHTML = "max" + " <i class='fa fa-blank'></i>";
  th_max.addEventListener("click", function(e) {
    order_table("max", table_wrapper);
  });
  tr_header.appendChild(th_max);

  //add table head to table
  thead.appendChild(tr_header)
  table_wrapper.appendChild(thead)

  //create table body
  var tbody = document.createElement("tbody");

  //iterate all categoires
  for (const [index, category] of run_data.entries()) {

    //create the row
    var tr_cat = document.createElement("tr");
    tr_cat.classList.add("tr_pop_participant_row")
    tr_cat.setAttribute("original_order", index)

    //create the category name
    var td_cat_name = document.createElement("td");
    td_cat_name.classList.add("col_cat_name");
    td_cat_name.style.width = adapted_width + "px";
    td_cat_name.innerHTML = category["astring"];

    //create number of registered participants
    var td_cat_registered = document.createElement("td");
    td_cat_registered.classList.add("col_registered");
    td_cat_registered.innerHTML = category["participants_registered"];

    //create max number of participants
    var td_cat_max = document.createElement("td");
    td_cat_max.classList.add("col_max");
    td_cat_max.innerHTML = category["participants_max"];

    //calculate how full the run alrady is (in percentage)
    let percentage = parseInt(category["participants_registered"]) / parseInt(category["participants_max"]) * 100

    if (percentage > 90) {
      td_cat_registered.style.color = "red";
      td_cat_max.style.color = "red";
    } else if (percentage > 70) {
      td_cat_registered.style.color = "orange";
      td_cat_max.style.color = "orange";
    } else {
      td_cat_registered.style.color = "green";
      td_cat_max.style.color = "green";
    }

    //append columns to row
    tr_cat.appendChild(td_cat_name);
    tr_cat.appendChild(td_cat_registered);
    tr_cat.appendChild(td_cat_max);

    //add to the tbody
    tbody.appendChild(tr_cat);
  }
  table_wrapper.appendChild(tbody);

  //set thead and tbody width
  var thead = table_wrapper.children[0];
  thead.style.width = table_width + "px";

  var tbody = table_wrapper.children[1];
  tbody.style.width = table_width + "px";

  //hide the loader
  div_wrapper_loader.classList.add("hidden");
}

// initialize the database that keeps offline settings
function init_DB() {

  //should be async
  return new Promise((resolve, reject) => {

    //check if indexedDB is allowed
    if (!window.indexedDB) {
      window.alert("This program is using indexedDB to store the tasks. Without no proper function is guaranteed");
    }

    // open  database
    var open = window.indexedDB.open("database_survivalmap", 1)

    //if db must be upgraded (if it is not existing)
    open.onupgradeneeded = function(event) {

      db = event.target.result;

      //check if the settings storage is existing -> if not create
      if (!db.objectStoreNames.contains('settings')) {
        var objectStore = db.createObjectStore('settings', {
          keyPath: "settings_id"
        });
      }

      //check if the run storage is existing -> if not create
      if (!db.objectStoreNames.contains('seasons')) {
        var objectStore = db.createObjectStore('seasons', {
          keyPath: "season"
        })
      }

      //check if the filter storage is existing -> if not create
      if (!db.objectStoreNames.contains('filter_settings')) {
        var objectStore = db.createObjectStore('filter_settings', {
          keyPath: "filter_id"
        });
      }

    }

    //if db could be opened sucessfully
    open.onsuccess = function() {
      resolve(open.result);
    }

    //if db couldn't be opened
    open.onerror = () => reject(open.error);

  });
}

//get data from db
function db_get_data(key, obj_store) {

  return new Promise((resolve, reject) => {

    var transaction = db.transaction(obj_store, "readwrite");
    var objectStore = transaction.objectStore(obj_store);

    //special key to return all valies
    if (key == '_all') {
      var request = objectStore.getAll();
    } else {
      var request = objectStore.get(key);
    }
    request.onsuccess = function() {
      //finish the function so that code execution can go on
      resolve(request.result);
    }
  });
}

//add data to the db
function db_add_data(key, obj, obj_store) {

  return new Promise((resolve, reject) => {
    var transaction = db.transaction(obj_store, "readwrite");
    var objectStore = transaction.objectStore(obj_store);

    var request = objectStore.put(obj);

    request.onsuccess = function() {
      resolve(request.result);
    }

  });

}

//edit data in db
async function db_edit_data(key, param, val, obj_store) {

  //first get the object we want to edit
  var obj = await db_get_data(key, obj_store)

  //change the obj
  obj[param] = val;

  //put it back in the indexedb
  return new Promise((resolve, reject) => {
    var transaction = db.transaction(obj_store, "readwrite");
    var objectStore = transaction.objectStore(obj_store);

    var request = objectStore.put(obj);

    request.onsuccess = function() {

      resolve(request.result);
    }
  });

}

//reset the db
function db_reset() {

  let delete_db = confirm("Do you really want to reset the data? This step cannot be undone.")

  //we don't want to delete
  if (delete_db == false) {
    return
  }

  //close all connections to this db
  db.close()

  var req = indexedDB.deleteDatabase("database_survivalmap");

  req.onsuccess = async function() {
    alert("Database deleted successfully");
    db = await init_DB();
  };
  req.onerror = function() {
    alert("Couldn't delete database");
  };
  req.onblocked = function() {
    alert("Couldn't delete database due to the operation being blocked");
  };


}

//check if the filters are initialized and if not -> init them
function init_settings() {

  //should be async
  return new Promise((resolve, reject) => {

    //initial filter setting
    const filter_settings = {
      "personal_first_name": null,
      "personal_surname": null,
      "personal_association": null,
      "ask_for_name": true,
      "selected_language": null,
      "show_legend": true,
      "selected_season": null,
      "min_year_for_season": null,
      "max_year_for_season": null,
      "runs_maximum_age": null,
      "runs_maximum_age_text": null,
      "runs_maximum_age_slider_val": null
    }

    //connection tot the db
    var transaction = db.transaction(["settings"], "readwrite");
    var objectStore = transaction.objectStore("settings");

    //iterate all settings
    for (const [key, value] of Object.entries(filter_settings)) {

      //check if existing, if not add
      var req = objectStore.openCursor(key);
      req.onsuccess = function(e) {
        var cursor = e.target.result;

        //key is not exiting -> add to db
        if (!cursor) {
          let obj = {
            "settings_id": key,
            "settings_val": value
          }
          objectStore.add(obj)
        }
      };

    }

    //return back to main
    resolve()

  });

}

//change some values to default values if they are not set yet
function set_default_settings() {

  //should be async
  return new Promise(async (resolve, reject) => {

    //get additional setting values from the server
    var additional_settings = await get_data_from_server("get_settings");

    //check if we want to ask for the name
    var ask_for_name = await db_get_data("ask_for_name", "settings")
    if (ask_for_name.settings_val == true) {
      console.log("ask for name");
    }

    //check the language
    var selected_language = await db_get_data("selected_language", "settings")
    if (selected_language.settings_val == null) {

      //get user language
      var userLang = navigator.language || navigator.userLanguage;
      await db_edit_data("selected_language", "settings_val", userLang, "settings")

    }

    //check the season
    var selected_season = await db_get_data("selected_season", "settings")
    if (selected_season.settings_val == null) {
      let month = new Date().getMonth()
      let year = new Date().getFullYear();

      //if we are early in the season we sill need the calendar from previous year
      if (month < 7) {
        year = year - 1
      }

      //create the season string and update db
      let season_string = String(year) + "/" + String(year + 1)
      await db_edit_data("selected_season", "settings_val", season_string, "settings")

    }

    //set min and max year of the season
    let min_year_for_season = additional_settings.min_year_for_season;
    let max_year_for_season = additional_settings.max_year_for_season;

    await db_edit_data("min_year_for_season", "settings_val", min_year_for_season, "settings")
    await db_edit_data("max_year_for_season", "settings_val", max_year_for_season, "settings")

    //check the maximum age for runs
    var selected_season = await db_get_data("runs_maximum_age", "settings");
    if (selected_season.settings_val == null) {

      //1h to milliseconds
      var one_hour = 1000 * 60 * 60

      await db_edit_data("runs_maximum_age", "settings_val", one_hour, "settings");
      await db_edit_data("runs_maximum_age_text", "settings_val", "1 hour", "settings");
      await db_edit_data("runs_maximum_age_slider_val", "settings_val", 2, "settings");

    }

    //return back to main
    resolve()
  });

}

//set the text values of some html elements
async function set_html_css_values() {

  //should be async
  return new Promise(async (resolve, reject) => {

    //get the season and set the html
    let selected_season = await db_get_data("selected_season", "settings");
    selected_season = selected_season.settings_val;
    document.getElementById("div_selected_season").innerHTML = selected_season;

    //not changing the season in reality, just for changing the coor of the buttons
    change_season("color_change");

    resolve();
  });
}

//check if the filters are initialized and if not -> init them
function init_filters() {

  //should be async
  return new Promise((resolve, reject) => {

    //initial filter setting
    const filter_settings = {
      "cat_lsr": true,
      "cat_msr": true,
      "cat_ksr": true,
      "cat_bsr": true,
      "cat_jsr": true,
      "cat_rec": true,
      "length_short": true,
      "length_medium": true,
      "length_long": true,
      "length_estaffete": true,
      "subs_open": true,
      "subs_notyetopen": true,
      "subs_closed": true,
      "subs_cancelled": true,
      "day_weekdays": true,
      "day_sat": true,
      "day_sun": true,
    }

    //connection tot the db
    var transaction = db.transaction(["filter_settings"], "readwrite");
    var objectStore = transaction.objectStore("filter_settings");

    //iterate all settings
    for (const [key, value] of Object.entries(filter_settings)) {

      //check if existing, if not add
      var req = objectStore.openCursor(key);
      req.onsuccess = function(e) {
        var cursor = e.target.result;

        //key is not exiting -> add to db
        if (!cursor) {
          let obj = {
            "filter_id": key,
            "filter_val": value
          }
          objectStore.add(obj)
        }
      };

    }

    //return back to main
    resolve()

  });
}

//get data from the server
function get_data_from_server(url, params = null) {

  return new Promise(resolve => {

    var request = new XMLHttpRequest();
    request.open('POST', url, true);
    request.setRequestHeader('content-type', 'application/json');
    if (params != null) {
      request.send(JSON.stringify(params));
    } else {
      request.send()
    }

    request.onreadystatechange = function() {

      if (request.readyState == 4)
        if (request.status == 200) {
          let data = JSON.parse(request.responseText)
          resolve(data)
        }
    }
  });
}

//add markers and popups to the map
function set_markers_and_popups() {

  return new Promise(async (resolve, reject) => {

    //delete all old markers
    for (var [marker_key, marker] of Object.entries(markerArr)) {
      map.removeLayer(marker);
    }
    markerArr = {};

    //get the run data from the right_season
    var current_season = await db_get_data("selected_season", "settings");
    var season_data = await db_get_data(current_season.settings_val, "seasons");

    //should not happen, but just to be sure
    if (season_data == undefined) {
      console.log("data for " + current_season.settings_val + " is undefined");
      resolve()
    }
    season_data = season_data.data;

    //iterate the data
    for (var key in season_data) {
      let run_obj = season_data[key];

      if (Object.keys(run_obj)[0] != "categories") {
        var bool_multiday_run = true;
        var temp_key = Object.keys(run_obj)[0]
        var run_attr_name = run_obj[temp_key]["run_name"];
        var coords = run_obj[temp_key]["coordinates"];
      } else {
        var bool_multiday_run = false;
        var run_attr_name = run_obj["run_name"];
        var coords = run_obj["coordinates"];
      }

      // marker only for valid coordinates
      if (coords == undefined || coords.length != 2) {
        console.log("NO COORDINATES FOR A RUN:");
        console.log(key);
        console.log(run_obj);
        continue
      }

      //create popup
      var pop = document.createElement("div");

      //check run name
      if (run_attr_name == undefined || run_attr_name == "") {
        var run_name = "Placeholder";
      } else {
        var run_name = run_attr_name;
      }

      //add symbolsfor left and right (if run on multiple days)
      var symbol_left = document.createElement("i");
      symbol_left.classList.add("fa");
      symbol_left.classList.add("fa-chevron-left");
      symbol_left.classList.add("symbol_left");
      symbol_left.classList.add("hidden");
      symbol_left.addEventListener("click", function(e) {
        switch_popup_day(e, 'previous');
      });
      pop.appendChild(symbol_left);

      var symbol_right = document.createElement("i");
      symbol_right.classList.add("fa");
      symbol_right.classList.add("fa-chevron-right");
      symbol_right.classList.add("symbol_right");
      if (bool_multiday_run == false) {
        symbol_right.classList.add("hidden");
      }
      symbol_right.addEventListener("click", function(e) {
        switch_popup_day(e, 'next');
      });
      pop.appendChild(symbol_right);

      //we iterate this array
      var runs = [];
      if (bool_multiday_run == true) {
        for (var tmp_key of Object.keys(run_obj)) {
          runs.push(run_obj[tmp_key])
        }
      } else {
        runs.push(run_obj)
      }

      var bool_show = true;
      for (var run of runs) {

        var pop_div_wrapper = document.createElement("div");
        pop_div_wrapper.classList.add("pop_div_wrapper")

        //only show the first and hide the other ones
        if (bool_show == true) {
          bool_show = false;
        } else {
          pop_div_wrapper.classList.add("hidden");
        }

        //get the weekday
        var weekday = get_weekday(run["date"], "normal");
        var date_str = run["date"] + " (" + weekday + ")";

        //get the date of the run in machine readable format
        var dateParts = run.date.split("-");
        var run_date = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]);

        //add title
        var pop_div_title = document.createElement("div");
        pop_div_title.innerHTML = run_name;
        pop_div_title.classList.add("div_pop_title");
        pop_div_wrapper.appendChild(pop_div_title);

        //add info city
        var pop_div_city = document.createElement("div");
        var pop_div_city_desc = document.createElement("div");
        pop_div_city_desc.innerHTML = "Location:";
        pop_div_city_desc.classList.add("div_pop_desc");
        pop_div_city.appendChild(pop_div_city_desc);

        var pop_div_city_val = document.createElement("div");
        pop_div_city_val.innerHTML = run["city"];
        pop_div_city_val.classList.add("div_pop_val");
        pop_div_city.appendChild(pop_div_city_val);
        pop_div_wrapper.appendChild(pop_div_city);

        //add info date
        var pop_div_date = document.createElement("div");
        var pop_div_date_desc = document.createElement("div");
        pop_div_date_desc.innerHTML = "Date: ";
        pop_div_date_desc.classList.add("div_pop_desc");
        pop_div_date.appendChild(pop_div_date_desc);

        var pop_div_date_val = document.createElement("div");
        pop_div_date_val.innerHTML = date_str;
        pop_div_date_val.classList.add("div_pop_val");
        pop_div_date.appendChild(pop_div_date_val);
        pop_div_wrapper.appendChild(pop_div_date);

        //add info Association
        var pop_div_association = document.createElement("div");
        var pop_div_association_desc = document.createElement("div");
        pop_div_association_desc.innerHTML = "Association: ";
        pop_div_association_desc.classList.add("div_pop_desc");
        pop_div_association.appendChild(pop_div_association_desc);

        var pop_div_association_val = document.createElement("div");
        pop_div_association_val.innerHTML = run["association"];
        pop_div_association_val.classList.add("div_pop_val");
        pop_div_association.appendChild(pop_div_association_val);
        pop_div_wrapper.appendChild(pop_div_association);

        //add info hyperlink
        var pop_div_hyperlink = document.createElement("div");
        var pop_div_hyperlink_desc = document.createElement("div");
        pop_div_hyperlink_desc.innerHTML = "Website: ";
        pop_div_hyperlink_desc.classList.add("div_pop_desc");
        pop_div_hyperlink.appendChild(pop_div_hyperlink_desc);

        var pop_a_hyperlink_val = document.createElement("a");
        pop_a_hyperlink_val.innerHTML = run["hyperlink"];
        pop_a_hyperlink_val.href = run["hyperlink"];
        pop_a_hyperlink_val.target = "_blank";
        pop_a_hyperlink_val.classList.add("div_pop_val");
        pop_div_hyperlink.appendChild(pop_a_hyperlink_val);
        pop_div_wrapper.appendChild(pop_div_hyperlink);

        //add info distances
        var pop_div_distances = document.createElement("div");
        var pop_div_distances_desc = document.createElement("div");
        pop_div_distances_desc.innerHTML = "Distances: ";
        pop_div_distances_desc.classList.add("div_pop_desc");
        pop_div_distances.appendChild(pop_div_distances_desc);

        //get the distances and add km
        var distance_str = "";
        for (var afst of run["distances"]) {
          if (afst == "estaffete") {
            distance_str = distance_str + afst;
          } else {
            distance_str = distance_str + afst + "km, ";
          }
        }

        if (distance_str.endsWith("km, ")) {
          distance_str = distance_str.substring(0, distance_str.length - 2);
        }

        var pop_div_distances_val = document.createElement("div");
        pop_div_distances_val.innerHTML = distance_str;
        pop_div_distances_val.classList.add("div_pop_val");
        pop_div_distances.appendChild(pop_div_distances_val);
        pop_div_wrapper.appendChild(pop_div_distances);

        //add info categories
        var pop_div_categories = document.createElement("div");
        var pop_div_categories_desc = document.createElement("div");
        pop_div_categories_desc.innerHTML = "Categories: ";
        pop_div_categories_desc.classList.add("div_pop_desc");
        pop_div_categories.appendChild(pop_div_categories_desc);

        //get the categories and colour them
        var categories_str = "";
        for (var cat of run["categories"]) {
          if (cat == "L") {
            var col = "black";
          } else if (cat == "M") {
            var col = "red";
          } else if (cat == "K") {
            var col = "#3333ff";
          } else if (cat == "B") {
            var col = "green";
          } else if (cat == "J") {
            var col = "orange";
          } else if (cat == "recr") {
            var col = "grey"
          }
          categories_str = categories_str + "<b><span style='color:" + col + "'>" + cat + "</span></b> ";
        }

        var pop_div_categories_val = document.createElement("div");
        pop_div_categories_val.innerHTML = categories_str;
        pop_div_categories_val.classList.add("div_pop_val");
        pop_div_categories.appendChild(pop_div_categories_val);
        pop_div_wrapper.appendChild(pop_div_categories);

        //just add some space between the divs
        var pop_div_space = document.createElement("div");
        pop_div_space.classList.add("div_pop_space");
        pop_div_wrapper.appendChild(pop_div_space);

        //in this wrapper we will show the runs
        var pop_table_participant_wrapper = document.createElement("table");
        pop_table_participant_wrapper.classList.add("table_pop_participant_wrapper");
        pop_div_wrapper.appendChild(pop_table_participant_wrapper);

        //add a small loader in this wrapper
        var pop_div_participant_loader = document.createElement("div");
        pop_div_participant_loader.classList.add("lds-ellipsis");
        for (var i = 0; i <= 3; i++) {
          var tmp_div = document.createElement("div");
          pop_div_participant_loader.appendChild(tmp_div);
        }
        pop_div_wrapper.appendChild(pop_div_participant_loader);

        //just add some space between the divs
        var pop_div_space = document.createElement("div")
        pop_div_space.classList.add("div_pop_space");
        pop_div_wrapper.appendChild(pop_div_space);

        //add inschrijflink
        var pop_div_subscribe = document.createElement("div")
        pop_div_subscribe.classList.add("div_pop_big")

        //check the different states
        if (run_date < new Date() && run["cancelled"] != true) {
          pop_div_subscribe.innerHTML = "Run finished!";
          pop_div_subscribe.style.color = "red";
        } else if (run["cancelled"]) {
          pop_div_subscribe.innerHTML = "Cancelled!";
          pop_div_subscribe.style.color = "red";
        } else if (run["subscription_status"] == "gesloten") {
          pop_div_subscribe.innerHTML = "Subscription closed!";
          pop_div_subscribe.style.color = "red";
        } else if (run["subscription_status"].length <= 1) {
          pop_div_subscribe.innerHTML = "Subscription not possible!";
          pop_div_subscribe.style.color = "red";
        } else if (run["subscription_status"] == ">schrijf hier in<" || run["subscription_status"].startsWith("tot ")) {
          var pop_a_subscribe = document.createElement("a");
          pop_a_subscribe.innerHTML = "Subscribe";
          pop_a_subscribe.href = run["subscription_link"];
          pop_a_subscribe.target = "_blank";
          pop_div_subscribe.appendChild(pop_a_subscribe);
        } else {
          var splits = run["subscription_status"].split(" ");
          pop_div_subscribe.innerHTML = "Opens " + splits[1] + " " + splits[2];
        }
        pop_div_wrapper.appendChild(pop_div_subscribe);

        pop.appendChild(pop_div_wrapper);
      }

      //add route calculation
      var pop_div_route = document.createElement("div");
      pop_div_route.classList.add("div_pop_big")
      var pop_a_route = document.createElement("a");
      pop_a_route.innerHTML = "Calculate route";
      var base_link = "https://www.google.com/maps/dir//" + coords[0] + "," + coords[1];
      pop_a_route.href = base_link;
      pop_a_route.target = "_blank";
      pop_div_route.appendChild(pop_a_route);
      pop.appendChild(pop_div_route);

      //specify popup options
      var pop_options = {
        width: 'auto'
      }

      //get the right marker colour
      var icon_col = "orange";
      if (run_date < new Date() && run["cancelled"] != true) {
        var icon_col = "red";
      } else if (run["cancelled"]) {
        var icon_col = "gray";
      } else if (run["subscription_status"] == ">schrijf hier in<" || run["subscription_status"].startsWith("tot ")) {
        var icon_col = "green";
      } else if (run["subscription_status"] == "gesloten") {
        var icon_col = "red";
      } else if (run["subscription_status"].startsWith("Opent")) {
        var icon_col = "blue";
      }

      //set marker at the position
      var marker = L.marker(coords, {
        icon: iconsArr[icon_col]
      });
      marker.run_id = run["subscription_id"];
      marker.bindPopup(pop, pop_options);
      marker.addTo(map);
      markerArr[key] = marker;

    }
    resolve();
  });
}

//with this function it is possible for multi-day-runs to switch between the days
function switch_popup_day(e, mode) {

  //get the parent and then all divwrappers
  var parent = e.target.parentElement;
  var wrappers = parent.querySelectorAll('.pop_div_wrapper')

  //get which object is current visible
  var visible_pos = undefined;
  for (const [index, child] of wrappers.entries()) {
    if (child.classList.contains("hidden") == false) {
      visible_pos = index;
      child.classList.add("hidden");
    }
  }

  //change this position
  if (mode == "previous") {
    visible_pos = visible_pos - 1;
  } else if (mode == "next") {
    visible_pos = visible_pos + 1;
  }

  //show the new child
  for (const [index, child] of wrappers.entries()) {
    if (index == visible_pos) {
      child.classList.remove("hidden");
    }
  }

  //get right and left button
  if (e.target.classList.contains("fa-chevron-right")) {
    var right_button = e.target;
    var left_button = e.target.previousSibling;
  } else if (e.target.classList.contains("fa-chevron-left")) {
    var left_button = e.target;
    var right_button = e.target.nextSibling;
  }

  //take care of the buttons
  if (visible_pos == 0) {
    left_button.classList.add("hidden");
    right_button.classList.remove("hidden");
  } else if (visible_pos == wrappers.length - 1) {
    left_button.classList.remove("hidden");
    right_button.classList.add("hidden");
  } else {
    left_button.classList.remove("hidden");
    right_button.classList.remove("hidden");
  }

}

//function is called to make the searchbar white again (after we have an invalid search)
function reset_searchbar() {

  //reset to white color
  document.getElementById("input_searchbar").style.backgroundColor = "white";
}

//handles what happens if we have input for the searchbar (-> search with enter or show autocomplete)
async function handle_searchbar(e) {

  //get the input text value
  var val = document.getElementById("input_searchbar").value;

  //set link to autocomplete_box
  var ac_box = document.getElementById("autocomplete_box");

  //get the run data from the right_season
  var current_season = await db_get_data("selected_season", "settings");
  var data_season = await db_get_data(current_season.settings_val, "seasons");
  var dataArr = data_season.data;

  //reset autocomplete_box
  ac_box.innerHTML = '';

  //do nothing if nothing is entered
  if (val.length == 0) {
    return
  }

  //jump to the run
  if ((e.key) == "Enter" && e instanceof KeyboardEvent) {

    //check what is matching
    var matching_keys = [];

    //search for this run in the array
    for (var key in dataArr) {

      if (Object.keys(dataArr[key])[0] == "categories") {

        //get the values we want to check
        var city = dataArr[key]["city"];
        var association = dataArr[key]["association"];
        var run_name = dataArr[key]["run_name"];

      } else {

        let _key = Object.keys(dataArr[key])[0];

        //get the values we want to check
        var city = dataArr[key][_key]["city"];
        var association = dataArr[key][_key]["association"];
        var run_name = dataArr[key][_key]["run_name"];

      }

      //we have a match! -> add to the matching keys
      if (city != undefined && city.toLowerCase() == val.toLowerCase()) {
        matching_keys.push(key);
      } else if (association != undefined && association.toLowerCase() == val.toLowerCase()) {
        matching_keys.push(key);
      } else if (run_name != undefined && run_name.toLowerCase() == val.toLowerCase()) {
        matching_keys.push(key);
      }


    }

    //we didn't find a match
    if (matching_keys.length == 0) {

      // Add a class that defines an animation
      document.getElementById("input_searchbar").classList.add('error');

      //set to red background
      document.getElementById("input_searchbar").style.backgroundColor = "#ffcccb";

      // remove the class after the animation completes
      setTimeout(function() {
        document.getElementById("input_searchbar").classList.remove('error');
      }, 300);

      //only 1 match, that's easy
    } else if (matching_keys.length == 1) {
      let key = matching_keys[0];
      let coords = dataArr[key]["coordinates"];
      if (coords != undefined) {
        map.setView(coords, 12);
      } else {
        console.log("An error happened with the coordinates");
      }

      //multiple matches
    } else {

      //get the markers we need
      var markers = [];
      for (var key of matching_keys) {
        markers.push(markerArr[key]);
      }

      //create a group with this markers
      var group = new L.featureGroup(markers);

      //set map to show all markers
      map.fitBounds(group.getBounds().pad(0.5));

    }
  }

  //create the autocomplete box
  else {

    //We need at least two characters to give useful hints
    if (val.length < 2) {
      document.getElementById("autocomplete_box").classList.add("hidden");
      return
    }

    var autocomplete_list = {};

    for (var key in dataArr) {

      if (Object.keys(dataArr[key])[0] == "categories") {

        //get the values we want to check
        var city = dataArr[key]["city"];
        var association = dataArr[key]["association"];
        var run_name = dataArr[key]["run_name"];

      } else {

        let _key = Object.keys(dataArr[key])[0];

        //get the values we want to check
        var city = dataArr[key][_key]["city"];
        var association = dataArr[key][_key]["association"];
        var run_name = dataArr[key][_key]["run_name"];

      }

      //we have a match! -> add to the matching keys
      if (run_name != undefined && run_name.toLowerCase().includes(val.toLowerCase())) {
        autocomplete_list[run_name] = key;
      } else if (city != undefined && city.toLowerCase().includes(val.toLowerCase())) {
        autocomplete_list[city] = key;
      } else if (association != undefined && association.toLowerCase().includes(val.toLowerCase())) {
        autocomplete_list[association] = key;
      }
    }

    if (Object.keys(autocomplete_list).length > 0) {
      document.getElementById("autocomplete_box").classList.remove("hidden");
    } else {
      document.getElementById("autocomplete_box").classList.add("hidden");
    }


    let index = 0;
    for (var searchVal in autocomplete_list) {

      //we only want max five suggestions
      if (index == 5) {
        break
      }
      index = index + 1;

      //create the autocomplete_entry
      var div = document.createElement("div");
      div.classList.add("autocomplete_element")
      div.key = autocomplete_list[searchVal];
      div.addEventListener("click", function(e) {
        select_searchbar_entry(e)
      });

      //make the search vale bold
      var pos_of_substring = searchVal.toLowerCase().indexOf(val.toLowerCase());
      let notboldText0 = searchVal.substring(0, pos_of_substring)
      let boldText = searchVal.substring(pos_of_substring, pos_of_substring + val.length);
      let notboldText1 = searchVal.substring(pos_of_substring + val.length)
      div.innerHTML = notboldText0 + "<strong>" + boldText + "</strong>" + notboldText1;

      //set to the autocomplete_box
      ac_box.appendChild(div);

    }

  }
}

//handles what happens if we click on a searchbar entry
async function select_searchbar_entry(e) {

  //get the run data from the right_season
  var current_season = await db_get_data("selected_season", "settings");
  var data_season = await db_get_data(current_season.settings_val, "seasons");
  var dataArr = data_season.data;

  //get the clicked element
  var div = e.target;

  //set the value of the search field
  let text = div.innerHTML
  text = text.replace('<strong>', '').replace('</strong>', '');
  document.getElementById("input_searchbar").value = text;

  //zoom to the clicked element
  if (Object.keys(dataArr[div.key])[0] == "categories") {
    var coords = dataArr[div.key]["coordinates"];
  } else {
    let key = Object.keys(dataArr[div.key])[0]
    var coords = dataArr[div.key][key]["coordinates"];
  }

  if (coords != undefined) {
    map.setView(coords, 12);
  } else {
    console.log("An error happened with the coordinates");
  }

  //reset autocomplete_box
  document.getElementById("autocomplete_box").innerHTML = '';

}

//all that happens when you cange the season
async function change_season(mode) {

  //reset the button colors
  document.getElementById("div_button_previous_season").style.color = "black";
  document.getElementById("div_button_next_season").style.color = "black";

  //get current season
  var current_season = await db_get_data("selected_season", "settings");
  var start_year = current_season.settings_val.split("/");

  //increase or decrease a year
  if (mode == 'next') {
    var new_year = parseInt(start_year) + 1;
  } else if (mode == "previous") {
    var new_year = parseInt(start_year) - 1;
  } else if (mode == "color_change") {
    var new_year = start_year[0];
  }

  //get min and max year
  let min_year_for_season = await db_get_data("min_year_for_season", "settings");
  min_year_for_season = min_year_for_season.settings_val;

  let max_year_for_season = await db_get_data("max_year_for_season", "settings");
  max_year_for_season = max_year_for_season.settings_val;

  //gray out the buttons
  if (new_year >= max_year_for_season) {
    document.getElementById("div_button_next_season").style.color = "gray";
  }
  if (new_year <= min_year_for_season) {
    document.getElementById("div_button_previous_season").style.color = "gray";
  }

  if (new_year < min_year_for_season) {
    return
  }

  if (new_year > max_year_for_season) {
    return
  }

  //color change mode is only when starting the website to make the buttons gray
  if (mode != "color_change") {

    //get the new season string
    let new_season = String(new_year) + "/" + String(new_year + 1)

    //save in database
    db_edit_data("selected_season", "settings_val", new_season, "settings")

    //change the season display
    document.getElementById("div_selected_season").innerHTML = new_season;

    //show the loader
    document.getElementById("div_loader").classList.remove("hidden");

    //get the run data, set markers, and filter
    let bool_success_get_season = await get_season(new_season);
    if (bool_success_get_season) {
      await set_markers_and_popups();
      await filter_runs();
    }

    //hide the loader
    document.getElementById("div_loader").classList.add("hidden");
  }
}

//handle everything that must be done when opening a menu
async function open_menu(menu_type) {

  //get the right menu
  if (menu_type == "main_menu") {
    var menu = document.getElementById("div_main_menu");
  } else if (menu_type == "legend") {
    var menu = document.getElementById("div_legend");
  }

  //remove the hidden to make the menu visible
  menu.classList.remove("hidden");

  //set the right position of the menu
  set_pos_of_elements();

  //make also the overlay visible
  var overlay = document.getElementById("div_overlay");
  overlay.classList.remove("hidden")

}

//close all open menus
function close_menu() {

  //get all menus
  const collection = document.getElementsByClassName("div_menu");

  //iterate all menus
  for (var menu of collection) {
    //add hidden
    menu.classList.add("hidden")
  }

  //hide the overlay
  var overlay = document.getElementById("div_overlay");
  overlay.classList.add("hidden")

}

//set the right position of the elements
function set_pos_of_elements() {

  // get all menus
  const collection = document.getElementsByClassName("div_menu");

  for (var menu of collection) {
    //get the menu width and set left
    var menu_width = parseInt(menu.offsetWidth / 2);
    menu.style.left = "calc(50% - " + menu_width + "px)"
  }

  var searchBar = document.getElementById("div_searchbar");
  var searchBar_width = parseInt(searchBar.offsetWidth / 2);
  searchBar.style.left = "calc(50% - " + searchBar_width + "px)"


}

//in the menu open anf fill a tab
async function open_tab(new_tab) {

  //if filter set all values of the checkboxes
  if (new_tab == "filters") {

    //get the filter values
    var filter_values = await db_get_data('_all', 'filter_settings');

    //iterate all filter values
    for (const value of Object.values(filter_values)) {

      //set checkbox checked/unchecked
      if (value.filter_val == true) {
        document.getElementById(value.filter_id).checked = true;
      } else {
        document.getElementById(value.filter_id).checked = false;
      }
    }
  }

  //if settings, set all values of the settings
  if (new_tab == "settings") {

    //set the slider
    let slider_val = await db_get_data('runs_maximum_age_slider_val', 'settings');
    let slider_text = await db_get_data('runs_maximum_age_text', 'settings');
    document.getElementById("input_season_sync_slider").value = slider_val.settings_val;
    document.getElementById("div_season_sync_slider").innerHTML = slider_text.settings_val;

  }

  //get all tabs and hide them
  var tabs = document.getElementsByClassName("tabcontent");
  for (var tab of tabs) {
    tab.classList.add("hidden");
  }

  //show the tab we want to have
  var new_tab = document.getElementById("div_tab_" + new_tab).classList.remove("hidden");

}

//at least one filter should always be active, this is checked here
function check_filter_validity(filter_id) {

  //get the new value of the checkbox
  var checkbox = document.getElementById(filter_id);

  //we only need to do it we want to uncheck a checbox
  if (checkbox.checked == false) {

    //get the filter type
    var filter_type = filter_id.split("_")[0];

    //get all checkboxes of this filtertype
    var collection_checkboxes = document.getElementsByClassName("filter_" + filter_type);

    //check how many filters are still checked
    var number_checked = 0;
    for (var _checkbox of collection_checkboxes) {
      if (_checkbox.checked) {
        number_checked = number_checked + 1;
      }
    }
  }

  //if no checkbox is left over undo the unchecking
  if (number_checked == 0) {
    checkbox.checked = true;
  }

}

//when you click the filter buttion several actions must be done
async function set_filters() {

  //get the filter values and set the data in db
  for (var checkbox of document.getElementsByClassName("check_filter")) {

    //change the value in the db
    await db_edit_data(checkbox.id, 'filter_val', checkbox.checked, 'filter_settings')

  }

  //filter all the runs based on the filter settings
  filter_runs();

  //close the menu
  close_menu();

}

//set all filter values back to non filtered
async function reset_filters() {

  //get the filter values and set the data in db
  for (var checkbox of document.getElementsByClassName("check_filter")) {

    //set the checbox to true
    checkbox.checked = true;

    //change the value in the db
    await db_edit_data(checkbox.id, 'filter_val', true, 'filter_settings');

  }

  //filter the runs
  filter_runs()

}

//find out which runs are filtered and change the marker symbols accordingly
async function filter_runs() {

  //get the run data from the right_season
  var current_season = await db_get_data("selected_season", "settings");
  var data_season = await db_get_data(current_season.settings_val, "seasons");
  var dataArr = data_season.data;

  //get the filters
  var filters = await db_get_data('_all', 'filter_settings');

  //what for filters do we have in each filter
  var filters_for_category = [];
  var filters_for_distance = [];
  var filters_for_subscription = [];
  var filters_for_day = [];

  //iterate all filters
  for (const filter_obj of Object.values(filters)) {

    //if the filter is not true we can skip it
    if (filter_obj.filter_val != true) {
      continue
    };

    //get the category filters
    if (filter_obj.filter_id.slice(0, 3) == "cat") {

      //translate the filter to the filter attributes
      if (filter_obj.filter_id.split("_")[1] == "rec") {
        filters_for_category.push('recr')
      } else {
        filters_for_category.push(filter_obj.filter_id.split("_")[1].slice(0, 1))
      }
    }

    //get the distance filter
    if (filter_obj.filter_id.slice(0, 3) == "len") {

      //get the distance filters
      if (filter_obj.filter_id.split("_")[1] == "short") {
        filters_for_distance.push([0, 7.5]);
      } else if (filter_obj.filter_id.split("_")[1] == "medium") {
        filters_for_distance.push([7.51, 15]);
      } else if (filter_obj.filter_id.split("_")[1] == "long") {
        filters_for_distance.push([15.01, 1000]);
      } else if (filter_obj.filter_id.split("_")[1] == "estaffete") {
        filters_for_distance.push(["estaffete"]);
      }
    }

    //get the subscription filter
    if (filter_obj.filter_id.slice(0, 3) == "sub") {

      //get the subscription filters
      if (filter_obj.filter_id.split("_")[1] == "closed") {
        filters_for_subscription.push(["gesloten"]);
      } else if (filter_obj.filter_id.split("_")[1] == "open") {
        filters_for_subscription.push([">schrijf hier in<", "tot"]);
      } else if (filter_obj.filter_id.split("_")[1] == "notyetopen") {
        filters_for_subscription.push(["Opent", "notyetopen"]);
      } else if (filter_obj.filter_id.split("_")[1] == "cancelled"){
        filters_for_subscription.push(["cancelled"])
      }
    }

    //get the run date filter
    if (filter_obj.filter_id.slice(0, 3) == "day") {

      if (filter_obj.filter_id.split("_")[1] == "weekdays") {
        filters_for_day.push(["mo", "tu", "we", "th", "fr"]);
      } else if (filter_obj.filter_id.split("_")[1] == "sat") {
        filters_for_day.push(["sa"]);
      } else if (filter_obj.filter_id.split("_")[1] == "sun") {
        filters_for_day.push(["su"]);
      }
    }
  }

  //here we save all runs we want to filter out
  var runs_to_filter = [];

  //iterate all runs
  for (var [run_key, _run] of Object.entries(dataArr)) {

    //which categories are in one run (over multiple days)
    var categories_per_run = [];
    var distances_per_run = []
    var subscriptions_per_run = []
    var days_per_run = [];
    var cancelled_per_run = [];

    //we have a run with multiple days
    if (Object.keys(_run)[0] != "categories") {
      for (var wday of Object.keys(_run)) {
        categories_per_run.push(...dataArr[run_key][wday]["categories"]);
        distances_per_run.push(...dataArr[run_key][wday]["distances"]);
        subscriptions_per_run.push(dataArr[run_key][wday]["subscription_status"]);
        days_per_run.push(dataArr[run_key][wday]["date"]);
        cancelled_per_run.push(dataArr[run_key][wday]["cancelled"]);
      }
    } else {
      categories_per_run.push(...dataArr[run_key]["categories"]);
      distances_per_run.push(...dataArr[run_key]["distances"]);
      subscriptions_per_run.push(dataArr[run_key]["subscription_status"]);
      days_per_run.push(dataArr[run_key]["date"]);
      cancelled_per_run.push(dataArr[run_key]["cancelled"]);
    }

    //is the run out to due to categories
    var bool_run_out_categories = true;

    //check the category filter
    for (var cat of categories_per_run) {

      //make everything small
      cat = cat.toLowerCase();

      //we have a match! so no need for filtering any longer
      if (filters_for_category.indexOf(cat) != -1) {
        bool_run_out_categories = false;
        continue
      }
    }

    //run is filtered out as there is no match
    if (bool_run_out_categories) {
      runs_to_filter.push(run_key)
      continue
    }

    //is the run out due to distance
    var bool_run_out_distance = true;

    //check the distance
    for (var distance of distances_per_run) {
      for (var _distance of filters_for_distance) {
        if (_distance[0] == "estaffete") {
          if (_distance[0] == distance) {
            bool_run_out_distance = false;
            continue
          }
        } else if (_distance[0] <= distance && distance <= _distance[1]) {
          bool_run_out_distance = false;
          continue
        }
      }
    }

    //run is filtered out as there is no match
    if (bool_run_out_distance) {
      runs_to_filter.push(run_key)
      continue
    }

    //is the run out due to subscription
    var bool_run_out_subscription = true;

    //check the subscription
    for (var [index, subscription] of subscriptions_per_run.entries()) {

      subscription = subscription.trimEnd();

      //change subcription based on some criteria (e.g a run that already was is gesloten)
      let temp_date = days_per_run[index];
      let temp_cancelled = cancelled_per_run[index];

      if (run_over(temp_date)){
        subscription = "gesloten";
      } else {
        if (subscription.length == 0 || subscription == " "){
          subscription = "Opent";
        }
      }

      if (temp_cancelled){
        subscription = "cancelled";
      }

      for (var _subscription of filters_for_subscription.flat()) {

        //change tot filter
        if (_subscription.startsWith("tot ")){
          _subscription == "Opent"
        }

        if (subscription.startsWith(_subscription)){
          bool_run_out_subscription = false;
          break
        }

      }
    }

    //run is filtered out as there is no match
    if (bool_run_out_subscription) {
       runs_to_filter.push(run_key)
      continue
    }

    //is the run out due to the day
    var bool_run_out_day = true;

    //check the day
    for (var day of days_per_run) {

      let weekday_short = get_weekday(day, "short");

      for (var _day of filters_for_day) {
        if (_day.indexOf(weekday_short) != -1) {
          bool_run_out_day = false;
          continue
        }
      }
    }

    //run is filtered out as there is no match
    if (bool_run_out_day) {
      runs_to_filter.push(run_key);
      continue
    }
  }

  //iterate all markers
  for (var [marker_key, marker] of Object.entries(markerArr)) {

    //we want to filter that run
    if (runs_to_filter.indexOf(marker_key) != -1) {
      marker.setOpacity(0.3);

      //this we don't want to filter
    } else {
      marker.setOpacity(1);
    }
  }
}

function order_table(column, table) {

  //get the right column number
  var columns = ["category", "reg", "max"];
  var col_nr = columns.indexOf(column);

  //reset all other columns order_direction to normal
  for (var i=0; i< table.rows[0].children.length; i++){

    //get the not selected columns
    if (i != col_nr){
      let col_ns = table.rows[0].children[i];
      col_ns.setAttribute("order_direction", "normal");
      col_ns.innerHTML = col_ns.innerHTML.split("<")[0].trimEnd() + " <i class='fa fa-blank'></i>";
    }
  }

  //get the old order direction and set the new on
  let col = table.rows[0].children[col_nr];
  var dir = col.getAttribute("order_direction");

  if (dir == "normal"){

    //change to new order direction (and also in table)
    dir = "asc";
    col.setAttribute("order_direction", dir);

    //change the icon
    col.innerHTML = col.innerHTML.split("<")[0].trimEnd() + " <i class='fa fa-caret-down'></i>"

  } else if (dir == "asc"){

    //change to new order direction (and also in table)
    dir = "desc";
    col.setAttribute("order_direction", dir);

    //change the icon
    col.innerHTML = col.innerHTML.split("<")[0].trimEnd() + " <i class='fa fa-caret-up'></i>"

  } else if (dir == "desc"){

    //change to new order direction (and also in table)
    dir = "normal";
    col.setAttribute("order_direction", dir);

    //change the icon
    col.innerHTML = col.innerHTML.split("<")[0].trimEnd() + " <i class='fa fa-blank'></i>"
  }

  //define some params
  var rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;

  //Set initial valuess
  switching = true;

  while (switching) {

    //start by saying there should be no switching:
    switching = false;

    //get the rows of the table
    rows = table.rows;

    //iterate all rows (start with 1, as 0 is the header)
    for (var i = 1; i < (rows.length - 1); i++) {

      shouldSwitch = false

      //get the right row_val
      let row_val_x = rows[i].children[col_nr].innerHTML.toLowerCase();
      let row_val_y = rows[i + 1].children[col_nr].innerHTML.toLowerCase();

      //convert to number if possible
      if (!isNaN(row_val_x)){
        row_val_x = parseInt(row_val_x);
      }
      if (!isNaN(row_val_y)){
        row_val_y = parseInt(row_val_y);
      }

      if (dir == "asc") {
        if (row_val_x > row_val_y) {
          //if so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      } else if (dir == "desc") {
        if (row_val_x < row_val_y) {
          //if so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      } else if (dir == "normal"){
        if (rows[i].getAttribute("original_order") > rows[i+1].getAttribute("original_order")){
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      /*If a switch has been marked, make the switch
      and mark that a switch has been done:*/
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      //Each time a switch is done, increase this count by 1:
      switchcount++;
    }
//    } else {
//      /*If no switching has been done AND the direction is "asc",
//      set the direction to "desc" and run the while loop again.*/
//      if (switchcount == 0 && dir == "asc") {
//        dir = "desc";
//        switching = true;
//      } else if (switchcount == 0 && dir == "desc"){
//        dir = "normal";
//        switching = true;
//      }
//    }
  }
}

//called by the sliders for the synctime
async function change_input_val(type, el) {

  if (type == "association") {
    console.log(el.value);
  } else if (type == "season") {

    //first is the textual description, the second the time in milisecond
    var season_values = {
      0: ["Instantly", 0],
      1: ["1 min", 1000 * 60],
      2: ["1 hour", 1000 * 60 * 60],
      3: ["1 day", 1000 * 60 * 60 * 24],
      4: ["1 week", 1000 * 60 * 60 * 24 * 7]
    };

    //save the selected synctime to the settings
    await db_edit_data("runs_maximum_age", "settings_val", season_values[el.value][1], "settings");
    await db_edit_data("runs_maximum_age_text", "settings_val", season_values[el.value][0], "settings");
    await db_edit_data("runs_maximum_age_slider_val", "settings_val", el.value, "settings");

    //write the selected sync name to the settings
    let div_desc = document.getElementById("div_season_sync_slider");
    div_desc.innerHTML = season_values[el.value][0];
  }


}

//get the weekday based on a date
function get_weekday(input_date, mode) {
  if (mode == "normal") {
    var weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  } else if (mode == "short") {
    weekdays = ["su", "mo", "tu", "we", "th", "fr", "sa"]
  }
  var dateParts = input_date.split("-");
  var date = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]);
  var weekday = weekdays[date.getDay()];
  return weekday
}

function run_over(input_date){
  var dateParts = input_date.split("-");
  var date = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]);

  if (date - new Date() < 0){
    return true
  } else {
    return false
  }

}
