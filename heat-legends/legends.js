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
        names: ["James", "Robert", "John", "William", "Richard", "David", "Charles", "Thomas", "Michael", "Ronald", "Larry", "Donald", "Joseph", "Gary", "George", "Kenneth", "Paul", "Edward", "Jerry", "Dennis", "Mario", "Dan", "Phil", "Bill", "Peter", "Johnnie", "Lee", "Troy", "Bob", "Pat", "Sam", "Jimmy", "Rodger", "Jim", "Richie"]
    },
    {
        country: "France",
        citizen: "French",
        flag: "france.png",
        names: ["Jean", "Michel", "Claude", "André", "Pierre", "Jacques", "Bernard", "Gérard", "Daniel", "René", "Robert", "Guy", "Roger", "Marcel", "Georges", "Alain", "Maurice", "Henri", "Joseph", "Paul", "Alain", "René", "Jacques", "Didier", "Maurice", "Patrick", "Jean-Pierre", "Patrick", "François", "Jean-Pierre", "Jean", "Olivier", "Pierre", "Esteban"]
    },
    {
        country: "UK",
        citizen: "British",
        flag: "uk.png",
        names: ["John", "David", "Michael", "Peter", "Robert", "Anthony", "Brian", "Alan", "William", "James", "Richard", "Kenneth", "Roger", "Keith", "Colin", "Christopher", "Raymond", "Terence", "Thomas", "Barry", "Lewis", "Nigel", "Jackie", "Jim", "Damon", "Stirling", "Jenson", "Graham", "David", "James", "Tony", "John", "John", "Eddie", "Mike", "Peter", "Johnny", "Innes", "Peter", "George"]
    },
    {
        country: "Italy",
        citizen: "Italian",
        flag: "italy.png",
        names: ["Antonio", "Mario", "Roberto", "Leonardo", "Angelo", "Sergio", "Marco", "Arturo", "Luca", "Emilio", "Rodolfo", "Rocco", "Matteo", "Enzo", "Rico", "DeAngelo", "Carmelo", "Donte", "Emiliano", "Gian", "Alberto", "Riccardo", "Guiseppe", "Michele", "Giancarlo", "Elio", "Luigi", "Piero", "Luigi", "Giancarlo", "Lorenzo", "Ludovico", "Vittorio", "Alessandro", "Jarno"]
    },
    {
        country: "Germany",
        citizen: "German",
        flag: "germany.png",
        names: ["Hans", "Peter", "Klaus", "Wolfgang", "Jyrgen", "Dieter", "Manfred", "Uwe", "Gunter", "Horst", "Berndt", "Karl", "Werner", "Heinz", "Rolf", "Rainer", "Gerhard", "Helmut", "Michael", "Gert", "Michael", "Sebastian", "Nico", "Ralf", "Heinz-Harald", "Wolfgang", "Jochen"]
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
            $('.empty').show();
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
        $('.empty').show();
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
        $(".empty").hide();
        $(".buttons").addClass('enabled');
        $("#add").hide();
        $("#inputs").hide();
    })
});
