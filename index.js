var split = require('split'),
    Stream = require('stream'),
    duplex = require('duplexer');

function parse(line) {
        var m = line.match(/^(:(\S+))?\s*([^:]\S+)\s+([^:]+)?(\s*:(.+))?/);
        var raw = m[0], source = m[2], cmd = m[3], 
            params = m[4], text = m[6];
        if (params) params = params.trim().split(' ');
        var target = params ? params[0] : null;
        var user = source ? source.match('(.+)!(.+)@(.+)') : null;
        return {
            raw: raw,
            source: source,
            cmd: cmd,
            user: user ? { 
                address: user[0], 
                nick: user[1], 
                user: user[2], 
                host: user[3] 
            } : null,
            params: params,
            target: target,
            text: text
        }
}

function construct(args) {
    var d = [].slice.call(args);
    d[d.length - 1] = ':' + d[d.length - 1] + '\n';
    return d.join(' ');
}

module.exports = function(opt) {
    var out = new Stream(), inp = split();
    var self = duplex(inp, out);
    
    out.readable = true;

    self.send = function irc_send() {
        out.emit('data', construct(arguments));
    }
    self.send.raw = out.emit.bind(out, 'data');

    function listenConnect() {
        self.on('pipe', function(src) {
            src.on('connect', function() {
                self.emit('connect', src)
            });
        });
    }
    listenConnect();

    inp.on('data', function(line) {
        var data = parse(line);
        var evt = data.cmd.toLowerCase();
        if (~['data', 'drain', 'end', 'error', 'close', 'pipe'].indexOf(evt))
            evt = 'irc-' + data.cmd;
        self.emit('event', data);
        self.emit(evt, data);
    });
    
    var modules = {};
    self.load = function(name, obj) {
        modules[name] = obj(self);
    }
    self.require = function irc_require(name) {
        if (modules[name]) return modules[name];
        else throw name + " is not loaded, cannot be required";
    };

    return self;
};

