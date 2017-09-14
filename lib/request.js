var got = require('got'),
    Promise = require('bluebird'),
    validator = require('validator'),
    _  = require('lodash');

module.exports = function request(url, options) {
    if (_.isEmpty(url) || !validator.isURL(url)) {
        return Promise.reject(new Error('URL empty or invalid.'));
    }

    return new Promise(function (resolve, reject) {
        return got(
            url,
            options
        ).then(function (response) {
            return resolve(response);
        }).catch(function (err) {
            return reject(err);
        });
    });
};
