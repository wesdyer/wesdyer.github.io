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

var names = [
    "Luigi",
    "Maurice",
    "Stirling",
    "Jack",
    "Bruce",
    "Graham",
    "Jackie",
    "Denny",
    "Jochen",
    "Jean-Pierre",
    "Ronnie",
    "Niki",
    "Jody",
    "Patrick",
    "Carlos",
    "Gilles",
    "Riccardo",
    "Keke",
    "Alain",
    "Ayrton",
    "Michael",
    "Olivier",
    "Mika",
    "David",
    "Juan Pablo",
    "Jarno",
    "Kimi",
    "Fernando",
    "Lewis",
    "Jenson",
    "Mark",
    "Sebastian",
    "Nico",
    "Daniel",
    "Max",
    "Sergio",
    "Sebastian",
    "Nigel",
    "Jim",
    "Juan Manuel",
    "Nelson",
    "Damon",
    "Emerson",
    "Alberto",
    "Mario",
    "Alan",
    "Jacques",
    "Felipe",
    "Rubens",
    "James",
    "Gerhard",
    "Valtteri",
    "Rene",
    "Tony",
    "John",
    "Jochen",
    "Gilles",
    "Ralf",
    "Guiseppe",
    "Clay",
    "Michele",
    "Keke",
    "Charles",
    "Dan",
    "Eddie",
    "Mike",
    "Peter",
    "Phil",
    "Didier",
    "Thierry",
    "Heinz-Harald",
    "Johnny",
    "Giancarlo",
    "Bill",
    "Jose",
    "Maurice",
    "Wolfgang",
    "Pedro",
    "Jo",
    "Elio",
    "Lee",
    "Piero",
    "Troy",
    "Bob",
    "Pat",
    "Sam",
    "Luigi",
    "Sergio",
    "Rodger",
    "Innes",
    "Richie",
    "Ludovico",
    "Francois",
    "Vittorio",
    "Gunnar",
    "Alessandro",
    "Jean",
    "Jarno",
    "Robert",
    "Heikki",
    "Pastor",
    "Esteban",
    "George"
];

function create_name(color) {
    return select(names);
}

function corner_basic() {
    return [0, 0, 1, 1, 1, 2, 2, 2, 3, 3];
}

function driver_a(color) {
    let s = 0;
    let c = 0;
    let a = 0;
    let result = {
        name: create_name(color) + ' A',
        skill: 1,
        max_speed: () => 9 + rolln(1, 10) + s,
        approach: () => Math.max(0, select(corner_basic()) - a),
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

function driver_b(color) {
    let base = 6 + select([2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6]);
    let s = select([7, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 12]);
    let c = select([0, 0, 0, 1]);
    let a = select([0, 0, 0, 1]);
    var result = {
        name: create_name(color) + ' B',
        skill: 1,
        max_speed: () => base + rolln(1, s),
        approach: () => Math.max(0, select(corner_basic()) - a) ,
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

function driver_c(color) {
    let s = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    let c = corner_basic();
    let a = corner_basic();
    let result = {
        name: create_name(color) + ' C',
        skill: 1,
        max_speed: () => select(s),
        approach: () => select(a),
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

function make_driver(color) {
    const rd = roll(3);
    let df = null;
    if (rd <= 1) {
        df = driver_c;
    } else if (rd <= 2) {
        df = driver_b;
    } else {
        df = driver_a;
    }

    return df(color);
}

function create_driver(make_driver, color) {
    let d = make_driver();
    const drivers = $('#drivers');
    const e = $("<tr><td class='car'></td><td class='name'></td><td class='skill'></td><td class='max-speed'></td><td class='approach'></td><td class='corner'></td><td><div class='button upgrade'>Upgrade</div></td></tr>");
    e.attr("id", color);
    e.addClass("driver");
    drivers.append(e);

    const img = $("<img />");
    img.addClass("car");
    img.attr("src", color + ".png");
    e.find('.car').append(img);

    const skill = e.find('.skill');
    const max_speed = e.find(".max-speed");
    const approach = e.find(".approach");
    const corner = e.find(".corner");
    const upgrade = e.find(".upgrade");

    e.find(".name").text(d.name);

    upgrade.click(() => {
        d.upgrade();
        skill.text(d.skill);
    });

    d.next = () => {
        skill.text(d.skill);
        max_speed.text(d.max_speed());
        approach.text(d.approach());
        corner.text(d.corner());
    };

    return d;
}

$(document).ready(() => {
    var drivers = [];
    var next = () => {
        for (var driver of drivers) driver.next();
    };
    const setup = () => {
        $('.driver').remove();
        drivers = [];
        drivers.push(create_driver(make_driver, "blue"));
        drivers.push(create_driver(make_driver, "red"));
        drivers.push(create_driver(make_driver, "yellow"));
        drivers.push(create_driver(make_driver, "green"));
        drivers.push(create_driver(make_driver, "gray"));
        drivers.push(create_driver(make_driver, "black"));
        next();
    }
    setup();

    $("#next").click(next);
    $("#reset").click(setup);
});
