'use strict'

//global variables
var map; //the leaflet map
var iconsArr = {}; //contains the leaflet icons
var markerArr = {} //contains the markers on the leaflet
var dataArr = {}; //contains the run data
var filtersArr = {} //contains all active filters

//main function that is called when opening the site
async function init_page() {

  //create the map
  await init_map();

  await init_icons();

  //get the run data
  var run_data = await get_runs();

  if (run_data != undefined) {

    dataArr["runs"] = run_data;

    //set the markers on the map
    set_markers_and_popups();

  } else {
    console.log("TODO: ADD warning message");
  }

  //add event listener to resize
  window.addEventListener('resize', function(event) {
    set_pos_of_menus();
  }, true);

  //check if we should hide the help site
  var show_help = get_cookie('show_help');
  if (show_help == 'true'){
    document.getElementById("div_help").classList.remove("hidden");
    document.getElementById("div_overlay").classList.remove("hidden");
    set_pos_of_menus();
  } else {
    document.getElementById("check_no_show_help").checked = true;
  }

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
    };
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
    if (run["run_name"] == undefined || run["run_name"] == ""){
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

    var pop_div_date_val = document.createElement("div");
    pop_div_date_val.innerHTML = run["date"];
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
    var distance_str = ""
    for (var afst of run["afstanden"]){
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
    var klassement_str = ""
    for (var kla of run["klassement"]){
      if (kla == "L"){
        var col = "black"
      } else if (kla == "M"){
        var col = "red"
      } else if (kla == "K"){
        var col = "##3333ff"
      } else if (kla == "B"){
        var col = "green"
      } else if (kla == "J"){
        var col = "orange"
      }
      klassement_str = klassement_str + "<b><span style='color:" + col + "'>" + kla + "</span></b> "
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
    if (run["cancelled"]){
      pop_div_subscribe.innerHTML = "Cancelled!"
      pop_div_subscribe.style.color = "red"
    } else if (run["inschrijfstate"] == "gesloten"){
      pop_div_subscribe.innerHTML = "Subscription closed!"
      pop_div_subscribe.style.color = "red"
    } else if (run["inschrijfstate"].length == 1){
      pop_div_subscribe.innerHTML = "Subscription not possible!"
      pop_div_subscribe.style.color = "red"
    } else if (run["inschrijfstate"] == ">schrijf hier in<" || run["inschrijfstate"].startsWith("tot ")){
      var pop_a_subscribe = document.createElement("a");
      pop_a_subscribe.innerHTML = "Subscribe";
      pop_a_subscribe.href=run["Inschrijflink"];
      pop_a_subscribe.target="_blank";
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
    var base_link = "https://www.google.com/maps/dir//" + coords[0] + "," + coords[1]
    pop_a_route.href=base_link;
    pop_a_route.target="_blank";
    pop_div_route.appendChild(pop_a_route);
    pop.appendChild(pop_div_route);

    //specify popup options
    var pop_options = {
      width: 'auto'
    }

    //get the right marker colour
    var icon_col = "orange"
    if (run["cancelled"]){
      var icon_col = "gray"
    } else if (run["inschrijfstate"] == ">schrijf hier in<" || run["inschrijfstate"].startsWith("tot ")){
      var icon_col = "green"
    } else if (run["inschrijfstate"] == "gesloten") {
      var icon_col = "red"
    } else if (run["inschrijfstate"].startsWith("Opent")) {
      var icon_col = "blue"
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

function reset_searchbar(){
  //reset to white
  document.getElementById("input_searchbar").style.backgroundColor = "white"
}

//TOOD ADD X IN SEARCHBAR
function handle_searchbar(e) {

  //get the input text value
  var val = document.getElementById("input_searchbar").value

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
    var matching_keys = []

    //search for this run in the array
    for (var key in dataArr["runs"]) {

      //get the values we want to check
      var city = dataArr["runs"][key]["city"]
      var association = dataArr["runs"][key]["association"]
      var run_name = dataArr["runs"][key]["run_name"]

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
      if (coords != undefined){
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
    if (val.length < 2){
      document.getElementById("autocomplete_box").classList.add("hidden");
      return
    }

    var autocomplete_list = {}

    for (var key in dataArr["runs"]) {

      //get the values we want to check
      if (Object.keys(dataArr["runs"][key])[0] == "za"){
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

    if (Object.keys(autocomplete_list).length > 0){
      document.getElementById("autocomplete_box").classList.remove("hidden");
    } else {
      document.getElementById("autocomplete_box").classList.add("hidden");
    }


    let index = 0;
    for (var searchVal in autocomplete_list){

      //we only want max five suggestions
      if (index == 5){
        break
      }
      index = index + 1;

      //create the autocomplete_entry
      var div = document.createElement("div");
      div.classList.add("autocomplete_element")
      div.key = autocomplete_list[searchVal];
      div.addEventListener("click", function(e){
        select_searchbar_entry(e)
      });

      //make the search vale bold
      var pos_of_substring = searchVal.toLowerCase().indexOf(val.toLowerCase());
      let notboldText0 = searchVal.substring(0, pos_of_substring)
      let boldText = searchVal.substring(pos_of_substring, pos_of_substring+val.length);
      let notboldText1 = searchVal.substring(pos_of_substring+val.length)
      div.innerHTML = notboldText0 + "<strong>" + boldText + "</strong>" + notboldText1;

      //set to the autocomplete_box
      ac_box.appendChild(div)

    }

  }
}

function select_searchbar_entry(e){

  //get the clicked element
  var div = e.target;

  //set the value of the search field
  let text = div.innerHTML
  text = text.replace('<strong>','').replace('</strong>','');
  document.getElementById("input_searchbar").value = text;

  //zoom to the clicked element
  if (Object.keys(dataArr["runs"][div.key])[0] == "za") {
    var coords = dataArr["runs"][div.key]["za"]["coordinates"];
  } else {
    var coords = dataArr["runs"][div.key]["coordinates"];
  }
  if (coords != undefined){
    map.setView(coords, 12);
  } else {
    console.log("An error happened with the coordinates");
  }

  //reset autocomplete_box
  document.getElementById("autocomplete_box").innerHTML='';

}

function open_menu(menu_type){

  if (menu_type == "filter"){
    var menu = document.getElementById("div_filters");
  } else if (menu_type == "help"){
    var menu = document.getElementById("div_help");
  }

  //remove the hidden to make the menu visible
  menu.classList.remove("hidden")

  //set the right position of the menu
  set_pos_of_menus();

  //make also the overlay visible
  var overlay = document.getElementById("div_overlay");
  overlay.classList.remove("hidden")

}

function close_menu(){

  // get all menus
  const collection = document.getElementsByClassName("div_menu");

  for (var menu of collection){
    //add hidden
    menu.classList.add("hidden")
  }

  var overlay = document.getElementById("div_overlay");
  overlay.classList.add("hidden")

}

function set_pos_of_menus(){

  // get all menus
  const collection = document.getElementsByClassName("div_menu");

  for (var menu of collection){
    //get the menu width and set left
    var menu_width = parseInt(menu.offsetWidth/2);
    menu.style.left = "calc(50% - " + menu_width + "px)"
  }

}

function filter_values(){

}

function change_cookie(cookie_val){

  if (cookie_val == 'auto_show_help'){
    var check_val = document.getElementById("check_no_show_help").checked;
    if (check_val){
      document.cookie = "show_help=false;expires='Thu, 01 Jan 2025 04:14:07 GMT";
    } else {
      document.cookie = "show_help=true;expires='Thu, 01 Jan 2025 04:14:07 GMT'";
    }
  }
}

function get_cookie(cookieName) {
  let cookie = {};
  document.cookie.split(';').forEach(function(el) {
    let [key,value] = el.split('=');
    cookie[key.trim()] = value;
  })
  return cookie[cookieName];
}
