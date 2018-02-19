/** Creates a w x h maze with corridors of 0 and walls of 255 expressed
    as an array of arrays using floodfill.

    If wrap is true, then the maze is on a torus. Otherwise it is on a rectangle.

    Imperfect is the maximum fraction of additional connections (creating loops). The default
    is zero. The maximum is 1.

    Fill is how much of the space (very roughly) the maze should fill. 1.0 fills the entire
    space. 0.0 gives a very thin and stringy result.

    Morgan McGuire
    @CasualEffects
    https://casual-effects.com

    BSD License
*/
function makeMaze(w, h, wrap, imperfect, fill) {
    let random = Math.random;
    let floor = Math.floor;

    w = floor(w || 32);
    h = floor(h || w);
    imperfect = Math.min(1, Math.max(0, imperfect || 0));
    if (fill === undefined) { fill = 1; }
    let res = 1 - Math.min(Math.max(0, fill * 0.9 + 0.1), 1);

    if (wrap) {
        // Ensure even size
        w += w & 1; h += h & 1;
    } else {
        // Ensure odd size
        w += ~(w & 1); h += ~(h & 1);
    }

    // Allocate and initialize to solid
    const SOLID = 255, RESERVED = 127, EMPTY = 0;
    let maze = new Array(w);
    for (let x = 0; x < w; ++x) {
        maze[x] = new Array(h).fill(SOLID);
    }

    // Reserve some regions
    if (res > 0) {
        for (let x = 1; x < w; x += 2) {
            for (let y = 1, m = maze[x]; y < h; y += 2) {
                if (random() < res) { m[y] = RESERVED; }
            } // y
        } // x
    }


    // Find a non-reserved cell from which to begin carving
    let cur = {x:1 + floor(w / 2 - 2) * 2, y:1 + floor(h / 2 - 2) * 2, step:{x:0, y:0}};
    while (maze[cur.x][cur.y] !== SOLID) {
        cur.x = floor(random() * (w - 4) / 2) * 2 + 1;
        cur.y = floor(random() * (h - 4) / 2) * 2 + 1;
    }
    
    // Carve hallways recursively
    let stack = [cur];
    let directions = [{x:-1, y:0}, {x:1, y:0}, {x:0, y:1}, {x:0, y:-1}];

    // Don't start reserving until a path of at least this length has been carved
    let ignoreReserved = Math.max(w, h);

    function unexplored(x, y) {
        let c = maze[x][y];
        return (c === SOLID) || ((c === RESERVED) && (ignoreReserved > 0));
    }
    
    while (stack.length) {
        let cur = stack.pop();

        // Unvisited?
        if (unexplored(cur.x, cur.y)) {
            
            // Mark visited
            maze[cur.x][cur.y] = EMPTY;
            --ignoreReserved;

            // Carve the wall back towards the source
            maze[(cur.x - cur.step.x + w) % w][(cur.y - cur.step.y + h) % h] = EMPTY;

            // Fisher-Yates shuffle directions
            for (let i = 3; i > 0; --i) {
                let j = floor(random() * (i + 1));
                [directions[i], directions[j]] = [directions[j], directions[i]];
            }
            
            // Push neighbors if not visited
            for (let i = 0; i < 4; ++i) {
                let step = directions[i];
                let x = cur.x + step.x * 2;
                let y = cur.y + step.y * 2;
                if (wrap) {
                    x = (x + w) % w;
                    y = (y + h) % h;
                }
                
                if ((x >= 0) && (y >= 0) && (x < w) && (y < h) && unexplored(x, y)) {
                    // In bounds and not visited
                    stack.push({x:x, y:y, step:step});
                }
            } // for each direction
        } // if unvisited
    } // while unvisited

    
    if (imperfect > 0) {
        var bdry = wrap ? 0 : 1;

        // Removes if not  attached to some passage
        function remove(x, y) {
            let a = maze[x][(y + 1) % h], b = maze[x][(y - 1 + h) % h],
                c = maze[(x + 1) % w][y], d = maze[(x - 1 + w) % w][y];
            if (Math.min(a, b, c, d) === EMPTY) {
                maze[x][y] = EMPTY;
            }
        }
        
        // Remove some random walls, preserving the edges if not wrapping.
        for (let i = Math.ceil(imperfect * w * h / 3); i > 0; --i) {
            remove(floor(random() * (w * 0.5 - bdry * 2)) * 2 + 1, floor(random() * (h * 0.5 - bdry * 2)) * 2 + bdry * 2);
            remove(floor(random() * (w * 0.5 - bdry * 2)) * 2 + bdry * 2, floor(random() * (h * 0.5 - bdry * 2)) * 2 + 1);
        }
        
        // Reconnect single-wall islands
        for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
                let a = maze[x][(y + 1) % h], b = maze[x][(y - 1 + h) % h],
                    c = maze[(x + 1) % w][y], d = maze[(x - 1 + w) % w][y];
                
                if (a === EMPTY && b === EMPTY && c === EMPTY && d === EMPTY) {
                    // This is an island. Restore one adjacent wall at random
                    let dir = directions[floor(random() * 4)];
                    maze[(x + w + dir.x) % w][(y + h + dir.y) % h] = SOLID;
                }
            } // x
        } // y
    }

    // Unreserve everything
    if (res > 0) {
        for (let x = 1; x < w; x += 2) {
            for (let y = 1, m = maze[x]; y < h; y += 2) {
                if (m[y] === RESERVED) { m[y] = SOLID; }
            } // y
        } // x
    } // res

    return maze;
}


/** 
    Thickens a 2D array maze for variable width halls and walls.
    Assumes a maze generated by makeMaze in which the walls are always on even rows and
    columns. The output is no longer of that form.
*/
function mazeToMap(maze, hallWidth, wallWidth) {
    hallWidth = Math.max(1, hallWidth || 1);
    wallWidth = Math.max(1, wallWidth || 1);
    
    let width = maze.length, height = maze[0].length;

    let map = [];
    
    for (let x = 0; x < width; ++x) {
        let src = maze[x];
        for (let i = ((x & 1) ? hallWidth : wallWidth); i > 0; --i) {
            let dst = [];
            for (let y = 0; y < height; ++y) {
                let c = src[y];
                for (let j = ((y & 1) ? hallWidth : wallWidth); j > 0; --j) {
                    dst.push(c);
                } // j
            } // y
            map.push(dst);
        } // i
    } // x

    return map;
}


/** Draws 0 as empty, 255 as solid, strings as their first character, 
    and everything else as half-solid. */
function mapToString(map) {
    let width = map.length, height = map[0].length;

    let s = '';
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            let c = map[x][y];
            s += (c === 255) ? '&#x2588;' : (c === 0) ? ' ' : c.codePointAt ? c[0] : '&#x2591;';
        }
        s += '\n';
    }
    
    return s;
}
