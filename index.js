/**
 * Created on 2017/4/11.
 * @fileoverview 请填写简要的文件说明.
 * @author joc (Chen Wen)
 */
const _DDP = require('ddp.js');
import EJSON from 'ejson';

let getParams = params => EJSON.toJSONValue(params);
let getResult = result => result && EJSON.fromJSONValue(result) || result;

class DDP extends _DDP {
    constructor (...args) {
        super(...args);
        this._pendingMethods = {};
        this._pendingSubscriptions = {};
        this.on('result', message => {
            let cache = this._pendingMethods[message.id];
            if (!cache) {
                return;
            }

            message = getResult(message);

            if (typeof cache === 'function') {
                return cache(message.error, message.result);
            }
            cache.callback.call(cache.context, message.error, message.result);
        });

        this.on('ready', message => {
            message.subs.forEach(id => {
                let cb = this._pendingSubscriptions[id];
                cb && cb(getResult(message));
            });
        });
    }

    _waitMethod (id) {
        return new Promise((resolve, reject) =>
            this._pendingMethods[id] = {
                callback: (err, res) => err && reject(err) || resolve(res)
            }
        );
    }

    _waitSubscription (id) {
        return new Promise((resolve, reject) =>
            this._pendingSubscriptions[id] = {
                onReady: (err, res) => err && reject(err) || resolve(res)
            }
        );
    }

    apply (method, args, callback) {
        let id = this.method(method, getParams(args));
        if (callback) {
            return this._pendingMethods[id] = {callback};
        }

        return this._waitMethod(id);
    }

    call (method, ...args) {
        let lastArg = args.pop();
        if (typeof lastArg !== 'function') {
            args.push(lastArg);
            lastArg = null;
        }

        return this.apply(method, args, lastArg);
    }

    subscribe (...args) {
        let lastArg = args.pop();
        if (typeof lastArg !== 'function') {
            args.push(lastArg);
            lastArg = null;
        }

        let id = this.sub(...getParams(args));

        if (lastArg) {
            return this._pendingSubscriptions[id] = {onReady: lastArg};
        }

        return this._waitSubscription(id);
    }
}

export default DDP;