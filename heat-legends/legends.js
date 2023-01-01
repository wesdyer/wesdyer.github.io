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
        names: ['Johnny','André','Jacques','Georges','Arthur','Charles','Paul','Olivier','Christian','Lucien','Alain','Willy','Jacky','Teddy','Louis','Lucas','Daniel','Thomas','Victor','Simon','Hugo','Gabriel','Jules','Finn','André','Pierre','Adrien','Achille','Matteo']
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
        names: ['Tony','Jack','Paul','Ken','Frank','Tim','Vern','Larry','Oliver','Noah','William','Henry','James','Gabriel','Caleb','Leo','Liam','Elijah','Levi','Alexander','Sebastian','Xavier']
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
        names: ['Dries','Carel','Gijs','Roelof','Boy','Jan','Hendrik','Pieter','Willem','Jacob','Dirk','Arie','Johan','Michael','Jeffrey','Johannes','Thomas']
    },
    {
        country: "Canada",
        citizen: "Canadian",
        flag: "canada.png",
        names: ['Peter','Eppie','Al','Bill','John','George','Eppie','James','Logan','Oliver','Nicholas','Benjamin','Leo','Nathan','Theodore','Liam','Alexander','Owen']
    },
    {
        country: "Sweden",
        citizen: "Swedish",
        flag: "sweden.png",
        names: ['Jo','Ronnie','Reine','Torsten','Gunnar','Lucas','Liam','William','Elias','Noah','Hugo','Oliver','Oscar','Adam','Matteo','Lars','Mikael','Anders','Erik','Per','Karl','Jan']
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
        names: ['Bruce','Tony','Chris','Denny','Howden','Oliver','Noah','Jack','Leo','George','Charlie','Lucas','Theodore','William','Luca','Elijah','Liam','Mason']
    },
    {
        country: "Mexico",
        citizen: "Mexican",
        flag: "mexico.png",
        names: ['Ricardo','Pedro','Moisés','Jose','Luis','Juan','Jesus','Jorge','Miguel','Antonio','Roberto','Ricardo','Fernando','Javier','Sergio','Martin']
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
]

function create_name(color) {
    return select(names);
}

function corner_basic() {
    return [0, 0, 1, 1, 1, 2, 2, 2, 3, 3];
}

function driver_a() {
    let s = 0;
    let c = 0;
    let a = 0;
    let result = {
        max_speed: () => 9 + rolln(1, 10) + s,
        over: () => Math.max(0, select(corner_basic()) - a),
        corner: () => select(corner_basic()) + c,
        upgrade: () => {
            let r = roll(6);
            if (r <= 3) {
                s++;
            } else if (r <= 5) {
                c++;
            } else {
                a--;
            }
            result.skill++;
        }
    };
    return result;
}

function driver_b() {
    let base = 6 + select([2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6]);
    let s = select([7, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 12]);
    let c = select([0, 0, 0, 1]);
    let a = select([0, 0, 0, 1]);
    var result = {
        max_speed: () => base + rolln(1, s),
        over: () => Math.max(0, select(corner_basic()) - a) ,
        corner: () => select(corner_basic()) + c,
        upgrade: () => {
            result.skill++;
            const r = roll(8);
            if (r <= 3) {
                s++;
            } else if (r <= 5) {
                base++;
            } else if (r == 7) {
                c++;
            } else {
                a++;
            }
        }
    };

    return result;
}

function driver_c() {
    let s = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    let c = corner_basic();
    let a = corner_basic();
    let result = {
        max_speed: () => select(s),
        over: () => select(a),
        corner: () => select(c),
        upgrade: () => {
            let r = roll(6);
            if (r <= 3) {
                s.push(14 + roll(6));
                s.push(14 + roll(6));
                s.push(14 + roll(6));
            } else if (r <= 5) {
                c.push(1 + roll(3));
                c.push(1 + roll(3));
                c.push(1 + roll(3));
            } else {
                a.push(roll(2) - 1);
                a.push(roll(2) - 1);
                a.push(roll(2) - 1);
            }
            result.skill++;
        }
    };
    return result;
}

function draw(deck, hand) {
    if (hand.length === 0) {
        for (let card of deck) {
            hand.push(card);
        }
    }
    const index = between(0, hand.length - 1);
    return hand.splice(index, 1)[0];
}

function custom_driver(color, speedDeck, overDeck, cornerDeck) {
    const nationality = select(nationalities);
    const name = select(nationality.names);
    console.log(speedDeck);

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

    return driver;
}

function create_driver(driver) {
    const e = $("<tr><td class='car'></td><td class='name'></td><td class='td-flag'><img class='flag'/></td><td class='max-speed'></td><td class='approach'></td><td class='corner'></td><td><div class='button remove'>Remove</div></td></tr>");
    e.attr("id", driver.color);
    e.addClass("driver");
    $('#drivers').append(e);

    const img = $("<img />");
    img.addClass("car");
    img.attr("src", driver.color + ".png");
    e.find('.car').append(img);

    const flag = e.find('.flag');
    flag.attr("src", "flags/" + driver.flag);

    const max_speed = e.find(".max-speed");
    const approach = e.find(".approach");
    const corner = e.find(".corner");
    const remove = e.find(".remove");

    e.find(".name").text(driver.name);

    remove.click(() => {
        $('.selector.' + driver.color).removeClass("added");
        $("#inputs").hide();
        $('.selected').removeClass("selected");
        $("#add").hide();
        e.remove();
        var index = drivers.indexOf(driver);
        if (index !== -1) drivers.splice(index, 1);
        if (drivers.length === 0) {
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

function initialize() {
    $("#speed").val("10, 11, 12, 13, 14, 15, 16, 17, 18, 19");
    $("#over").val("0, 0, 1, 1, 1, 2, 2, 2, 3, 3");
    $("#corner").val("0, 0, 1, 1, 1, 2, 2, 2, 3, 3");
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
    // drivers.push(create_driver(make_driver, "blue"));
    // drivers.push(create_driver(make_driver, "red"));
    // drivers.push(create_driver(make_driver, "yellow"));
    // drivers.push(create_driver(make_driver, "green"));
    // drivers.push(create_driver(make_driver, "gray"));
    // drivers.push(create_driver(make_driver, "black"));

    $("#next").click(function () {
        $('.selected').removeClass("selected");
        $("#add").hide();
        $("#inputs").hide();
        for (var driver of drivers) driver.next();
    });
    $("#reset").click(function() {
        $('.driver').remove();
        $('.selector').removeClass("added");
        $('#drivers').hide();
        $(".buttons").removeClass('enabled');
        $('.selected').removeClass("selected");
        $("#add").hide();
        $("#inputs").hide();
        drivers = [];
    });
    $(".selector").click(function () {
        $(".selected").removeClass("selected");
        $(this).addClass("selected");
        $("#add").show();
        $("#inputs").show();
        initialize();
    });
    $("#add").click(function () {
        var speed;
        var over;
        var corner;
        try {
            speed = parse("Speed", $("#speed").val());
        } catch (e) {
            $("#error").text(e);
            return;
        }
        try {
            over = parse("Over", $("#over").val());
        } catch (e) {
            $("#error").text(e);
            return;
        }
        try {
            corner = parse("Corner", $("#corner").val());
        } catch (e) {
            $("#error").text(e);
            return;
        }
        $("#error").text("");

        const color = $(".selected").attr("color");
        $(".selector." + color).addClass("added");
        drivers.push(create_driver(custom_driver(color, speed, over, corner)));
        $("#drivers").show();
        $(".buttons").addClass('enabled');
        $("#add").hide();
        $("#inputs").hide();
    })
});
