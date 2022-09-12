'use strict';

//global variables
var map; //the leaflet map
var iconsArr = {}; //contains the leaflet icons
var markerArr = {} //contains the markers on the leaflet
var dataArr = {}; //contains the run data
var db;

//main function that is called when opening the site
async function init_page() {

  //remove the nojs warning and show the elements
  document.getElementById("div_warning_message").classList.add("hidden");
  document.getElementById("div_hamburger").classList.remove("hidden");
  document.getElementById("div_searchbar").classList.remove("hidden");
  document.getElementById("div_question").classList.remove("hidden");

  //check if we should hide the help site
  var show_help = get_cookie('show_help');
  if (show_help == 'true') {
    document.getElementById("div_help").classList.remove("hidden");
    document.getElementById("div_overlay").classList.remove("hidden");
    set_pos_of_elements();
  } else {
    document.getElementById("check_no_show_help").checked = true;
  }

  //set right pos (for menus)
  set_pos_of_elements();

  //create the map
  await init_map();

  //create the icons
  await init_icons();

  //get the run data
  var run_data = await get_runs();

  if (run_data != undefined) {

    dataArr["runs"] = run_data;

    //set the markers on the map
    set_markers_and_popups();

  } else {
    window.alert("Something went wrong getting the run data. Please try again later.");
  }

  //init the database
  db = await init_DB();

  //init filters
  await init_filters();

  filter_runs()

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

  // ask for geolocation
  //if (window.navigator.geolocation) {
  //  navigator.geolocation.getCurrentPosition(thisPos)

  //  function thisPos(position) {
  //    map.setView([position.coords.latitude, position.coords.longitude], 11)
  //  }
  //}
}

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

      //check if the tasks storage is existing -> if not create
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
      "subs_open": true,
      "subs_notyetopen": true,
      "subs_closed": true,
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

//get a list of all runs from the server
function get_runs() {

  return new Promise(resolve => {

    var request = new XMLHttpRequest();

    request.open('POST', 'get_runs', true);
    request.setRequestHeader('content-type', 'application/json');
    request.send();

    request.onreadystatechange = function() {

      if (request.readyState == 4)
        if (request.status == 200) {
          let runs = JSON.parse(request.responseText)
          resolve(runs)
        }
    }
  });
}

//add markers and popups to the map
function set_markers_and_popups() {

  //get data from the dataArray
  let json_runs = dataArr["runs"];

  //iterate the data
  for (var key in json_runs) {
    let run = json_runs[key];

    if (Object.keys(run)[0] == "za") {
      run = run["za"]
    }

    // get the value for the run
    let coords = run["coordinates"];

    // marker only for valid coordinates
    if (coords != undefined && coords.length != 2) {
      continue
    }

    //create popup
    var pop = document.createElement("div");

    //check run name
    if (run["run_name"] == undefined || run["run_name"] == "") {
      var run_name = "Placeholder"
    } else {
      var run_name = run["run_name"]
    }

    //add title
    var pop_div_title = document.createElement("div");
    pop_div_title.innerHTML = run_name;
    pop_div_title.classList.add("div_pop_title");
    pop.appendChild(pop_div_title);

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
    pop.appendChild(pop_div_city);

    //add info date
    var pop_div_date = document.createElement("div");
    var pop_div_date_desc = document.createElement("div");
    pop_div_date_desc.innerHTML = "Date: ";
    pop_div_date_desc.classList.add("div_pop_desc");
    pop_div_date.appendChild(pop_div_date_desc);


    var weekday = get_weekday(run["date"]);
    var date_str = run["date"] + " (" + weekday + ")"

    var pop_div_date_val = document.createElement("div");
    pop_div_date_val.innerHTML = date_str;
    pop_div_date_val.classList.add("div_pop_val");
    pop_div_date.appendChild(pop_div_date_val);
    pop.appendChild(pop_div_date);

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
    pop.appendChild(pop_div_hyperlink);

    //add info distances
    var pop_div_distances = document.createElement("div");
    var pop_div_distances_desc = document.createElement("div");
    pop_div_distances_desc.innerHTML = "Distances: ";
    pop_div_distances_desc.classList.add("div_pop_desc");
    pop_div_distances.appendChild(pop_div_distances_desc);

    //get the distances and add km
    var distance_str = "";
    for (var afst of run["afstanden"]) {
      distance_str = distance_str + afst + "km, "
    }
    distance_str = distance_str.substring(0, distance_str.length - 2);


    var pop_div_distances_val = document.createElement("div");
    pop_div_distances_val.innerHTML = distance_str;
    pop_div_distances_val.classList.add("div_pop_val");
    pop_div_distances.appendChild(pop_div_distances_val);
    pop.appendChild(pop_div_distances);

    //add info categories
    var pop_div_categories = document.createElement("div");
    var pop_div_categories_desc = document.createElement("div");
    pop_div_categories_desc.innerHTML = "Categories: ";
    pop_div_categories_desc.classList.add("div_pop_desc");
    pop_div_categories.appendChild(pop_div_categories_desc);

    //get the categories and colour them
    var klassement_str = "";
    for (var kla of run["klassement"]) {
      if (kla == "L") {
        var col = "black";
      } else if (kla == "M") {
        var col = "red";
      } else if (kla == "K") {
        var col = "##3333ff";
      } else if (kla == "B") {
        var col = "green";
      } else if (kla == "J") {
        var col = "orange";
      }
      klassement_str = klassement_str + "<b><span style='color:" + col + "'>" + kla + "</span></b> ";
    }

    var pop_div_categories_val = document.createElement("div");
    pop_div_categories_val.innerHTML = klassement_str;
    pop_div_categories_val.classList.add("div_pop_val");
    pop_div_categories.appendChild(pop_div_categories_val);
    pop.appendChild(pop_div_categories);


    //just add some space between the divs
    var pop_div_space = document.createElement("div")
    pop_div_space.classList.add("div_pop_space");
    pop.appendChild(pop_div_space);

    //add inschrijflink
    var pop_div_subscribe = document.createElement("div")
    pop_div_subscribe.classList.add("div_pop_big")
    if (run["cancelled"]) {
      pop_div_subscribe.innerHTML = "Cancelled!"
      pop_div_subscribe.style.color = "red"
    } else if (run["inschrijfstate"] == "gesloten") {
      pop_div_subscribe.innerHTML = "Subscription closed!"
      pop_div_subscribe.style.color = "red"
    } else if (run["inschrijfstate"].length <= 1) {
      pop_div_subscribe.innerHTML = "Subscription not possible!"
      pop_div_subscribe.style.color = "red"
    } else if (run["inschrijfstate"] == ">schrijf hier in<" || run["inschrijfstate"].startsWith("tot ")) {
      var pop_a_subscribe = document.createElement("a");
      pop_a_subscribe.innerHTML = "Subscribe";
      pop_a_subscribe.href = run["Inschrijflink"];
      pop_a_subscribe.target = "_blank";
      pop_div_subscribe.appendChild(pop_a_subscribe);
    } else {
      var splits = run["inschrijfstate"].split(" ");
      pop_div_subscribe.innerHTML = "Opens " + splits[1] + " " + splits[2];
    }
    pop.appendChild(pop_div_subscribe);

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
    if (run["cancelled"]) {
      var icon_col = "gray";
    } else if (run["inschrijfstate"] == ">schrijf hier in<" || run["inschrijfstate"].startsWith("tot ")) {
      var icon_col = "green";
    } else if (run["inschrijfstate"] == "gesloten") {
      var icon_col = "red";
    } else if (run["inschrijfstate"].startsWith("Opent")) {
      var icon_col = "blue";
    }

    //set marker at the position
    var marker = L.marker(coords, {
      icon: iconsArr[icon_col]
    });
    marker.bindPopup(pop, pop_options);
    marker.addTo(map);
    markerArr[key] = marker;

  }
}

function reset_searchbar() {
  //reset to white
  document.getElementById("input_searchbar").style.backgroundColor = "white"
}

function handle_searchbar(e) {

  //get the input text value
  var val = document.getElementById("input_searchbar").value;

  //set link to autocomplete_box
  var ac_box = document.getElementById("autocomplete_box");

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
    for (var key in dataArr["runs"]) {

      //get the values we want to check
      var city = dataArr["runs"][key]["city"];
      var association = dataArr["runs"][key]["association"];
      var run_name = dataArr["runs"][key]["run_name"];

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
      document.getElementById("input_searchbar").style.backgroundColor = "#ffcccb"

      // remove the class after the animation completes
      setTimeout(function() {
        document.getElementById("input_searchbar").classList.remove('error');
      }, 300);

      //only 1 match, that's easy
    } else if (matching_keys.length == 1) {
      let key = matching_keys[0];
      let coords = dataArr["runs"][key]["coordinates"];
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

    var autocomplete_list = {}

    for (var key in dataArr["runs"]) {

      //get the values we want to check
      if (Object.keys(dataArr["runs"][key])[0] == "za") {
        var city = dataArr["runs"][key]["za"]["city"]
        var association = dataArr["runs"][key]["za"]["association"]
        var run_name = dataArr["runs"][key]["za"]["run_name"]
      } else {
        var city = dataArr["runs"][key]["city"]
        var association = dataArr["runs"][key]["association"]
        var run_name = dataArr["runs"][key]["run_name"]
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
      ac_box.appendChild(div)

    }

  }
}

function select_searchbar_entry(e) {

  //get the clicked element
  var div = e.target;

  //set the value of the search field
  let text = div.innerHTML
  text = text.replace('<strong>', '').replace('</strong>', '');
  document.getElementById("input_searchbar").value = text;

  //zoom to the clicked element
  if (Object.keys(dataArr["runs"][div.key])[0] == "za") {
    var coords = dataArr["runs"][div.key]["za"]["coordinates"];
  } else {
    var coords = dataArr["runs"][div.key]["coordinates"];
  }
  if (coords != undefined) {
    map.setView(coords, 12);
  } else {
    console.log("An error happened with the coordinates");
  }

  //reset autocomplete_box
  document.getElementById("autocomplete_box").innerHTML = '';

}

//handle everything that must be done when opening a menu
async function open_menu(menu_type) {

  //get the right menu
  if (menu_type == "filter") {
    var menu = document.getElementById("div_filters");
  } else if (menu_type == "help") {
    var menu = document.getElementById("div_help");
  }

  //if filter set all values of the checkboxes
  if (menu_type == "filter") {

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

  //remove the hidden to make the menu visible
  menu.classList.remove("hidden");

  //set the right position of the menu
  set_pos_of_elements();

  //make also the overlay visible
  var overlay = document.getElementById("div_overlay");
  overlay.classList.remove("hidden")

}

function close_menu() {

  // get all menus
  const collection = document.getElementsByClassName("div_menu");

  for (var menu of collection) {
    //add hidden
    menu.classList.add("hidden")
  }

  var overlay = document.getElementById("div_overlay");
  overlay.classList.add("hidden")

}

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

function change_filter(filter_id) {

  //get the new value of the checkbox
  var checked = document.getElementById(filter_id).checked;

  //change the value in the db
  db_edit_data(filter_id, 'filter_val', checked, 'filter_settings')

}

async function filter_runs() {

  //get the filters
  var filters = await db_get_data('_all', 'filter_settings');

  var matching_ids_cat = []
  var matching_ids_day = []
  var matching_ids_len = []
  var matching_ids_sub = []


  //iterate all filters
  for (const filter_obj of Object.values(filters)) {

    //if the filter is false, we don't need to check for this filter
    if (!filter_obj.filter_val) {
      continue;
    }

    //get filter cat
    var filter_id_cat = filter_obj.filter_id.slice(0, 3);
    var filter_id_val = filter_obj.filter_id.split("_")[1]

    //check for category
    if (filter_id_cat == "cat") {

      //get the right value we need later
      if (filter_id_val == "lsr") {
        var klass_val = 'L';
      } else if (filter_id_val == "msr") {
        var klass_val = 'M';
      } else if (filter_id_val == "ksr") {
        var klass_val = 'K';
      } else if (filter_id_val == "jsr") {
        var klass_val = 'J';
      } else if (filter_id_val == "bsr") {
        var klass_val = 'B';
      } else if (filter_id_val == "rec") {
        var klass_val = '';
      }

      //iterate all runs to check if we have a match
      for (var [run_key, run] of Object.entries(dataArr["runs"])) {

        if (Object.keys(run)[0] == "za") {
          run = run["za"]
        }

        //check if klassement is available for this run, if klass_val is empty
        //we check for recreante, which every run has
        if (klass_val == '' || run.klassement.indexOf(klass_val) != -1) {

          //only push if not in list of matching ids alrady
          if (matching_ids_cat.indexOf(run_key) == -1) {
            matching_ids_cat.push(run_key)
          }
        }
      }

    } else if (filter_id_cat == "day") {

      if (filter_id_val == "sat") {
        var klass_val = "Saturday";
      } else if (filter_id_val == "sun") {
        var klass_val = "Sunday";
      }

      for (var [run_key, run] of Object.entries(dataArr["runs"])) {

        if (Object.keys(run)[0] == "za") {
          run = run["za"]
        }

        if (klass_val == get_weekday(run.date)) {

          //only push if not in list of matching ids alrady
          if (matching_ids_day.indexOf(run_key) == -1) {
            matching_ids_day.push(run_key)
          }
        }
      }


    } else if (filter_id_cat == "len") {


      if (filter_id_val == "short") {
        var klass_val = [0, 7.5];
      } else if (filter_id_val == "medium") {
        var klass_val = [7.51, 15];
      } else if (filter_id_val == "long") {
        var klass_val = [15.01, 1000];
      }

      for (var [run_key, run] of Object.entries(dataArr["runs"])) {

        if (Object.keys(run)[0] == "za") {
          run = run["za"]
        }

        for (var afstand of run.afstanden) {
          if (klass_val[0] <= afstand && afstand <= klass_val[1]) {

            //only push if not in list of matching ids alrady
            if (matching_ids_len.indexOf(run_key) == -1) {
              matching_ids_len.push(run_key)
            }
          }
        }
      }

    } else if (filter_id_cat == "sub") {

      if (filter_id_val == "closed") {
        var klass_val = ["gesloten"];
      } else if (filter_id_val == "open") {
        var klass_val = [">schrijf hier in<", "tot "]
      } else if (filter_id_val == "notyetopen") {
        var klass_val = ["Opent", "notyetopen"];
      }

      for (var [run_key, run] of Object.entries(dataArr["runs"])) {

        if (Object.keys(run)[0] == "za") {
          run = run["za"]
        }

        for (var _klass_val of klass_val) {

          //some inschrijfstate are shorter then 4 chars, we need to catch it
          var temp_inschrijf = run.inschrijfstate;
          if (temp_inschrijf.length < 4) {
            temp_inschrijf = "notyetopen";
          }
          if (_klass_val.slice(0, 4) == temp_inschrijf.slice(0, 4)) {

            //only push if not in list of matching ids alrady
            if (matching_ids_sub.indexOf(run_key) == -1) {
              matching_ids_sub.push(run_key)
            }
          }
        }
      }
    }
  }


  //get the matching ids that are in all sub matching ids
  var temp_arr = [
    matching_ids_cat,
    matching_ids_day,
    matching_ids_len,
    matching_ids_sub
  ]

  var matching_ids = temp_arr.shift().filter(function(v) {
    return temp_arr.every(function(a) {
      return a.indexOf(v) !== -1;
    });
  });

  for (var [marker_key, marker] of Object.entries(markerArr)) {

    //if marker not a match
    if (matching_ids.indexOf(marker_key) == -1) {
      marker.setOpacity(0.4);

      //if marker is a match set back to full
    } else {
      marker.setOpacity(1);
    }

  }

}



function change_cookie(cookie_val) {

  if (cookie_val == 'auto_show_help') {
    var check_val = document.getElementById("check_no_show_help").checked;
    if (check_val) {
      document.cookie = "show_help=false;expires='Thu, 01 Jan 2025 04:14:07 GMT";
    } else {
      document.cookie = "show_help=true;expires='Thu, 01 Jan 2025 04:14:07 GMT'";
    }
  }
}

function get_cookie(cookieName) {
  let cookie = {};
  document.cookie.split(';').forEach(function(el) {
    let [key, value] = el.split('=');
    cookie[key.trim()] = value;
  })
  return cookie[cookieName];
}

function get_weekday(input_date){
  var weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var dateParts = input_date.split("-");
  var date = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]);
  var weekday = weekdays[date.getDay()];
  return weekday
}
