function roll(d) {
    return Math.floor(Math.random() * d) + 1;
}

function rolln(x, d) {
    let total = 0;
    for (let i = 0; i < x; ++i) total += roll(d);
    return total;
}

function between(x, y) {
    var d = y - x + 1;
    return x + Math.floor(Math.random() * d);
}

function gaussian(mean=0, stdev=1) {
    let u = 1.0 - Math.random();
    let v = Math.random();
    let z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    return z * stdev + mean;
}

function gaussian_bounded(from=0.0, to=1.0, mean=0.5, stdev=1.0) {
    while (true) {
        n = gaussian(mean, stdev);
        if (n < from || n >= to) continue;
        return n;
    }
}

function distro(f, n) {
    var results = {};
    var p = 1 / n;
    for (let i = 0; i < n; ++i) {
        const r = f();
        if (!(r in results)) results[r] = 0;
        results[r]++;
    }
    for (key in results) results[key] /= n;
    return results;
}

function select(xs) {
    return xs[Math.floor(xs.length * Math.random())];
}

var nationalities = [
    {
        country: "USA",
        citizen: "American",
        flag: "usa.png",
        names: ['Alfonso','Bob','Bobby','Brett','Bruce','Carroll','Chuck','Dan','Frank','Fred','George','Gus','Hap','Harry','Herbert','Jay','Jim','John','Lance','Lloyd','Mario','Mark','Masten','Pete','Peter','Phil','Richie','Robert','Rodger','Roger','Ronnie','Sam','Skip','Timmy','Tom','Tony','Troy','Walt']
    },
    {
        country: "France",
        citizen: "French",
        flag: "france.png",
        names: ['Yves','Louis','Philippe','Eugène','Raymond','Robert','Maurice','Henri','Pierre','Charles','Guy','Georges','Élie','Marcel','André','Roger','Jean','François','Bernard','Jo','Johnny','Patrick','José','Gérard','Michel']
    },
    {
        country: "UK",
        citizen: "British",
        flag: "uk.png",
        names: ['Reg','David','Leslie','Peter','Tony','Joe','Brian','Cuth','Bob','Geoffrey','Duncan','Stirling','George','Ken','John','Phillip','Lance','Eric','Alan','Mike','Robin','Graham','Bill','Dennis','Roy','Jack','Ian','Jimmy','Rodney','Ron','Don','Horace','Ted','Colin','Archie','Desmond','Bruce','Paul','Dick','Ivor','Bernie','Cliff','Stuart','Tom','Chris','Innes','Trevor','Keith','Tim','Vic','Henry','Jackie','Piers','Jonathan','Derek','Damien','Divina']
    },
    {
        country: "Italy",
        citizen: "Italian",
        flag: "italy.png",
        names: ['Guiseppe','Luigi','Consalvo','Piero','Franco','Nello','Alberto','Dorino','Felice','Clemente','Sergio','Umberto','Guerino','Gerino','Eugenio','Giorgio','Cesare','Guilio','Maria','Gino','Gaetano','Nino','Lorenzo','Massimo','Roberto','Ernesto','Ludovico','Geki','Andrea','Ignazio','Nanni','Arturo','Vittorio','Lella','Renzo']
    },
    {
        country: "Germany",
        citizen: "German",
        flag: "germany.png",
        names: ['Paul','Hans','Toni','Fritz','Theo','Willi','Helmut','Adolf','Josef','Günther','Ludwig','Harry','Ernst','Rudolf','Oswald','Erwin','Kurt','Edgar','Hermann','Karl','Gerhard','Hubert','Rolf','Jochen']
    },
    {
        country: "Switzerland",
        citizen: "Swiss",
        flag: "switzerland.png",
        names: ['Toulo','Toni','Rudi','Peter','Rudolf','Albert','Max','Ottorino','Michael','Jo','Heinz','Heini','Jean-Claude','Silvio','Xavier','Clay','Hans','Marco','Andreas','Lars','Vincent','Bruno','Emil','Simon']
    },
    {
        country: "Argentina",
        citizen: "Argentine",
        flag: "argentina.png",
        names: ['Juan Manuel','José','Alfredo','Onofre','Oscar','Adolfo','Carlos','Pablo','Roberto','Clemar','Jorge','Jesús','Alejandro','Nasif','Alberto','Nestor','Franco','Matias','Joaquin','Martin','Mauro','Tomas','Lucas','Federico','Santiago','Nicolas']
    },
    {
        country: "Belgium",
        citizen: "Belgian",
        flag: "belgium.png",
        names: ['Johnny','André','Jacques','Georges','Arthur','Charles','Paul','Olivier','Christian','Lucien','Alain','Willy','Jacky','Teddy','Thomas','Julien','Maxime','Alexandre','Nicolas','Kevin','Robin','Martin','Simon','Jonathan','Benjamin','Adrien']
    },
    {
        country: "Brazil",
        citizen: "Brazilian",
        flag: "brazil.png",
        names: ['Chico','Gino','Fritz','Emerson','Wilson','Carlos','Luiz','Alex','Ingo','Lucas','Ricardo','Pedro','Santos','Afonso','Joaquim','Duarte','André','Luiz','Julio','Enzo','Mateo','Salvador']
    },
    {
        country: "Australia",
        citizen: "Australian",
        flag: "australia.png",
        names: ['Tony','Jack','Paul','Ken','Frank','Tim','Vern','Larry','Oliver','Peter','John','Robert','David','Michael','Stephen','Ian','Gregory','Paul','Gary','Anthony','Wayne','Brian','Kevin']
    },
    {
        country: "Austria",
        citizen: "Austrian",
        flag: "austria.png",
        names: ['Jochen','Dieter','Niki','Helmut','Helmuth','Hans','Otto','Daniel','Andreas','Paul','Georg','Thomas','Emil','Simon','Wolfgang','Richard','Manfred']
    },
    {
        country: "Netherlands",
        citizen: "Dutch",
        flag: "netherlands.png",
        names: ['Dries','Carel','Gijs','Roelof','Boy','Jan','Hendrik','Pieter','Willem','Jacob','Dirk','Arie','Johan','Michael','Jeffrey','Johannes','Thomas','Cornelis','Adriaan']
    },
    {
        country: "Canada",
        citizen: "Canadian",
        flag: "canada.png",
        names: ['Eppie','Al','Bill','John','Eppie','Robert','John','Joseph','David','William','James','Richard','Michael','Donald','Ronald','Brian','Kenneth','Douglas','Thomas','Paul','Gary','Peter','George','Wayne','Larry']
    },
    {
        country: "Sweden",
        citizen: "Swedish",
        flag: "sweden.png",
        names: ['Jo','Ronnie','Reine','Torsten','Gunnar','Lucas','Liam','William','Elias','Noah','Hugo','Oliver','Oscar','Adam','Matteo','Lars','Mikael','Anders','Erik','Per','Karl','Jan','Bo']
    },
    {
        country: "Spain",
        citizen: "Spanish",
        flag: "spain.png",
        names: ['Paco','Juan','Paco','Alfonso','Antonio','Alex','Pablo','Martin','Alejandro','Lucas','Alvaro','Adrian','Mateo','David','Santiago','Felipe','Tomas','Diego']
    },
    {
        country: "New Zealand",
        citizen: "Kiwi",
        flag: "new-zealand.png",
        names: ['Bruce','Tony','Chris','Denny','Howden','David','Peter','Michael','John','Stephen','Mark','Paul','Robert','Christopher','Kevin','Anthony','Richard','Ian','Craig','William','Gregory','Wayne','Andrew','Grant','James']
    },
    {
        country: "Mexico",
        citizen: "Mexican",
        flag: "mexico.png",
        names: ['Ricardo','Pedro','Moisés','José','Luis','Juan','Jesús','Jorge','Miguel','Antonio','Roberto','Ricardo','Fernando','Javier','Sergio','Martin']
    },
    {
        country: "Finland",
        citizen: "Finish",
        flag: "finland.png",
        names: ['Leo', 'Antero','Tapani','Johannes','Tapio','Mikael','Kalevi','Matti','Pekka','Juhani','Olavi','Onni','Elno','Matias']
    },
    {
        country: "South Africa",
        citizen: "South African",
        flag: "south-africa.png",
        names: ['Tony','Doug','Neville','Ernie','Bruce','Trevor','Brausch','Peter','Paddy','Jackie','Dave','Luki','Basil','Jody','William','Eddie','Ian','Guy']
    },
    {
        country: "Denmark",
        citizen: "Danish",
        flag: "denmark.png",
        names: ["Tom", "Harald", "Peter", "Michael", "Lars", "Jens", "Thomas", "Henrik", "Søren", "Christian", "Martin", "Jan", "Morten", "Anders", "Jesper", "Niels", "Mads", "Rasmus", "Per", "Hans", "Mikkel", "Jørgen"]
    }
]

function draw(deck, hand) {
    if (hand.length === 0) {
        for (let card of deck) {
            hand.push(card);
        }
    }
    const index = between(0, hand.length - 1);
    return hand.splice(index, 1)[0];
}

function select_name(nationality) {
    return select(nationality.names);
}

function select_name_and_nationality() {
    const nationality = select(nationalities);
    const name = select(nationality.names);
    return {
        name: name,
        nationality: nationality
    };
}

function custom_driver(color, name, nationality, speedDeck, overDeck, cornerDeck) {
    let driver = {};
    driver.skill = 1;
    driver.color = color;
    driver.name = name;
    driver.country = nationality.country;
    driver.citizen = nationality.citizen;
    driver.flag = nationality.flag;

    var speedHand = [];
    var overHand = [];
    var cornerHand = [];

    driver.max_speed = function () {
        return draw(speedDeck, speedHand);
    };
    driver.over = function () {
        return draw(overDeck, overHand);
    };
    driver.corner = function () {
        return draw(cornerDeck, cornerHand);
    };

    driver.speedDeck = [...speedDeck]; // Create a copy
    driver.cornerDeck = [...cornerDeck]; // Create a copy

    return driver;
}

function create_driver(driver) {
    const e = $("<tr><td class='car'></td><td class='name'></td><td class='td-flag'><img class='flag'/></td><td class='max-speed'></td><td class='approach'></td><td class='corner'></td><td><div class='button remove'>Remove</div></td></tr>");
    e.attr("id", driver.color);
    e.addClass("driver");
    $('#drivers').append(e);

    const img = $("<img />");
    img.addClass("car");
    img.attr("src", "cars/" + driver.color + ".png");
    e.find('.car').append(img);

    const flag = e.find('.flag');
    flag.attr("src", "flags/" + driver.flag);

    const max_speed = e.find(".max-speed");
    const approach = e.find(".approach");
    const corner = e.find(".corner");
    const remove = e.find(".remove");

    e.find(".name").text(driver.name);

    remove.click(() => {
        if ($(this).hasClass("disabled")) return;
        $('.selector.' + driver.color).removeClass("added");
        $("#inputs").hide();
        $('.selected').removeClass("selected");
        e.remove();
        var index = drivers.indexOf(driver);
        if (index !== -1) drivers.splice(index, 1);
        if (drivers.length === 0) {
            $('.add .prompt').show();
            $('#drivers').hide();
            $(".buttons").removeClass('enabled');
            drivers = [];
        }
    });

    driver.next = () => {
        max_speed.text(driver.max_speed());
        approach.text(driver.over());
        corner.text(driver.corner());
    };

    return driver;
}

var drivers = [];
var chosen_nationality = null;
var chosen_name = null;
var currentDriverName = "";
var currentSpeedDeck = [];
var currentOverDeck = [];
var currentCornerDeck = [];

function initializeDeck() {
    currentSpeedDeck = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    currentOverDeck = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3];
    currentCornerDeck = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3];
}

function initialize() {
    initializeDeck();

    const nn = select_name_and_nationality();
    currentDriverName = nn.name; // Use the global variable
    $(".flag-selector").removeClass("selected");
    $("#flag-" + nn.nationality.country).addClass("selected");
    chosen_nationality = nn.nationality;
    chosen_name = nn.name; // This is used for comparison logic later
}

function parse(name, s) {
    if (s === "") {
        throw "Legends must have a " + name.toLowerCase() + ".";
    }

    let result = [];
    let parts = s.split(',');
    for (let part of parts) {
        part = part.trim();
        part = parseInt(part);
        if (isNaN(part)) {
            throw name + " must be numbers separated by commas.";
        }
        if (part < 0) {
            throw name + " must only be positive.";
        }
        if (part > 100) {
            throw name + " must be less than one hundred.";
        }
        result.push(part);
    }

    return result;
}

$(document).ready(() => {
    const flags = $(".flag-select-holder");
    let i = 0;
    for (let nationality of nationalities) {
        const n = nationality;
        const e = $("<div class='flag-selector'><img class='flag-select'/></div>")
        e.attr("id", "flag-" + nationality.country);
        e.find("img").attr("src", "flags/" + nationality.flag);
        e.click(function () {
            chosen_nationality = n;
            $('.flag-selector').removeClass('selected');
            $(this).addClass('selected');
            const name_input = $("#name");
            if (name_input.val() === chosen_name || name_input.val() === "") {
                const name = select_name(n);
                $("#name").val(name);
                chosen_name = name;
            }
        });
        flags.append(e);
        ++i;
    }

    $("#next").click(function () {
        if ($(this).hasClass("disabled")) return;

        $('.selected').removeClass("selected");
        $("#inputs").hide();
        for (var driver of drivers) driver.next();

        $("#next").addClass('disabled');
        $(".remove").addClass('disabled');

        const speed = 200;
        $('.max-speed, .corner, .approach').addClass('highlighted', speed, function () {
            $(this).removeClass('highlighted', speed, function () {
                $("#next").removeClass('disabled');
                $(".remove").removeClass('disabled');
            });
        });
    });
    $(".selector").click(function () {
        $(".add .prompt").hide();
        $(".selected").removeClass("selected");
        $(this).addClass("selected");
        $("#inputs").show();
        initialize();
    });
    $("#add").click(function () {
        // Error handling for parse() is removed for speed, over, corner.
        // If other errors can occur before this point, $("#error").text(""); might still be needed.
        // Assuming no other errors before this, it can be removed or adapted.
        // For now, let's assume other parts of the "inputs" div might still generate errors.
        // If not, the worker can advise on removing $("#error").text("").

        const color = $(".selected").attr("color");
        if (!color) { // It's good practice to check if a color is selected
            $("#error").text("Please select a car.");
            return;
        }
        $(".selector." + color).addClass("added");
        
        // Use global variables:
        drivers.push(create_driver(custom_driver(color, currentDriverName, chosen_nationality, currentSpeedDeck, currentOverDeck, currentCornerDeck)));
        
        $("#drivers").show();
        $(".buttons").addClass('enabled');
        $("#inputs").hide();
        // Clear any previous error messages if all operations are successful
        $("#error").text(""); 
    });
    $("#speed-plus,#speed-minus").click(function () {
        // No parsing needed, operate on currentSpeedDeck directly
        const id = $(this).attr("id");
        let mod = 1;
        if (id === "speed-minus") mod = -1;
        for (var i = 0; i < currentSpeedDeck.length; ++i) {
            currentSpeedDeck[i] += mod;
            if (currentSpeedDeck[i] >= 100) currentSpeedDeck[i] = 99;
            if (currentSpeedDeck[i] < 0) currentSpeedDeck[i] = 0;
        }
        // No need to set textbox value
        // Clear errors if parse was the only source for this handler
        $("#error").text(""); 
    });
    $("#corner-plus,#corner-minus").click(function () {
        // No parsing needed, operate on currentCornerDeck directly
        const id = $(this).attr("id");
        let mod = 1;
        if (id === "corner-minus") mod = -1;
        for (var i = 0; i < currentCornerDeck.length; ++i) {
            currentCornerDeck[i] += mod;
            if (currentCornerDeck[i] >= 100) currentCornerDeck[i] = 99;
            if (currentCornerDeck[i] < 0) currentCornerDeck[i] = 0;
        }
        // No need to set textbox value
        // Clear errors if parse was the only source for this handler
        $("#error").text("");
    });
    $("#reset").click(function () {
        initializeDeck();
    });
});
