var should = require('should'),
    sinon = require('sinon'),
    Promise = require('bluebird'),
    rewire = require('rewire'),

    // Stuff we are testing
    converter = rewire('../lib/converter'),

    sandbox = sinon.sandbox.create();

describe('Converter', function () {
    var imageCachStub;

    beforeEach(function () {
        imageCachStub = sandbox.stub();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('[success] transforms plain HTML into AMP-HTML', function (done) {
        var html = '<p>Test</p><div><h1>Heading</h1></div>';

        converter(html).then(function (result) {
            should.exist(result);
            result.should.be.eql(html);
            done();
        }).catch(done);
    });

    it('[success] transforms plain HTML into AMP-HTML when incl. not convertable tags', function (done) {
        var html = '<div><p>Test</p><div><h1>Heading</h1></div>' +
                   '<img src="http://example.com/content/images/small_img.jpg">' +
                   '<iframe src="https://www.youtube.com/embed/HMQkV5cTuoY" height="400"></iframe></div>';

        imageCachStub.returns(Promise.resolve({message: 'Image not found'}));
        converter.__set__('getCachedImageSize', imageCachStub);

        converter(html).then(function (result) {
            should.exist(result);
            result.should.match(/<div><p>Test<\/p><div><h1>Heading<\/h1><\/div>/);
            result.should.match(/<img src="http:\/\/example.com\/content\/images\/small_img.jpg">/);
            result.should.match(/<amp-iframe src="https:\/\/www.youtube.com\/embed\/HMQkV5cTuoY" height="400" width="600" sandbox="allow-scripts allow-same-origin" layout="responsive"><\/amp-iframe><\/div>/);
            done();
        }).catch(done);
    });

    it('[success] transforms children nodes into AMP-HTML', function (done) {
        var html = '<div><div class="some-wrapper-class"><p><img src="http://website.com/content/images/2017/09/image1.jpg" alt="image1.jpg"></p>' +
                   '<p><img src="http://website.com/content/images/2017/09/blog-cover.jpg" alt="blog-cover"></p>' +
                   '<p><img src="https://unsplash.com/some-other-image.jpg" alt="Furry cat sits on outside waiting to pounce"><br>' +
                   '<small>Photo by <a href="https://unsplash.com/">Marnhe du Plooy</a> / <a href="https://unsplash.com">Unsplash</a></small></p></div></div>';

        imageCachStub.returns(Promise.resolve({width: 600, height: 300, type: 'jpg'}));
        converter.__set__('getCachedImageSize', imageCachStub);

        converter(html).then(function (result) {
            should.exist(result);
            result.should.match(/<div><div class="some-wrapper-class"><p><amp-img src="http:\/\/website.com\/content\/images\/2017\/09\/image1.jpg" alt="image1.jpg" width="600" height="300" layout="responsive"><\/amp-img><\/p>/);
            result.should.match(/<p><amp-img src="http:\/\/website.com\/content\/images\/2017\/09\/blog-cover.jpg" alt="blog-cover" width="600" height="300" layout="responsive"><\/amp-img><\/p>/);
            result.should.match(/<p><amp-img src="https:\/\/unsplash.com\/some-other-image.jpg" alt="Furry cat sits on outside waiting to pounce" width="600" height="300" layout="responsive"><\/amp-img><br>/);
            result.should.match(/<small>Photo by <a href="https:\/\/unsplash.com\/">Marnhe du Plooy<\/a> \/ <a href="https:\/\/unsplash.com">Unsplash<\/a><\/small><\/p><\/div><\/div>/);
            done();
        }).catch(done);
    });

    describe('image tags', function () {
        it('[success] transforms small <img> into <amp-img></amp-img> with full image dimensions and fixed layout', function (done) {
            var html = '<img src="http://example.com/content/images/small_img.jpg">';

            imageCachStub.returns(Promise.resolve({width: 50, height: 50, type: 'jpg'}));
            converter.__set__('getCachedImageSize', imageCachStub);

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-img src="http:\/\/example.com\/content\/images\/small_img.jpg" width="50" height="50" layout="fixed"><\/amp-img>/);
                done();
            }).catch(done);
        });

        it('[success] transforms big <img> into <amp-img></amp-img> with full image dimensions and responsive layout', function (done) {
            var html = '<img src="http://example.com/content/images/large_img.jpg">';

            imageCachStub.returns(Promise.resolve({width: 350, height: 200, type: 'jpg'}));
            converter.__set__('getCachedImageSize', imageCachStub);

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-img src="http:\/\/example.com\/content\/images\/large_img.jpg" width="350" height="200" layout="responsive"><\/amp-img>/);
                done();
            }).catch(done);
        });

        it('[success] transforms .gif <img> with only height property into <amp-anim></amp-anim> with full dimensions by overriding them', function (done) {
            var html = '<img src="http://example.com/content/images/animated.gif" height="500">';

            imageCachStub.returns(Promise.resolve({width: 800, height: 600, type: 'gif'}));
            converter.__set__('getCachedImageSize', imageCachStub);

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-anim src="http:\/\/example.com\/content\/images\/animated.gif" height="600" width="800" layout="responsive"><\/amp-anim>/);
                done();
            }).catch(done);
        });

        it('[success] transforms invalid URL <img> into <amp-img></amp-img> with default image dimensions', function (done) {
            var html = '<img src="/content/images/large_img.jpg">';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-img src="\/content\/images\/large_img.jpg" width="800" height="600" layout="responsive"><\/amp-img>/);
                done();
            }).catch(done);
        });

        it('[success] transforms <img> with height attribute into <amp-img></amp-img> with default image dimensions and overwrites it', function (done) {
            var html = '<img src="/content/images/large_img.jpg" height="100">';

            imageCachStub.returns(Promise.resolve({width: 800, height: 600, type: 'jpg'}));
            converter.__set__('getCachedImageSize', imageCachStub);

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-img src="\/content\/images\/large_img.jpg" height="600" width="800" layout="responsive"><\/amp-img>/);
                done();
            }).catch(done);
        });

        it('[failure] can handle <img> tag without src and does not transform it', function (done) {
            var html = '<img><//img><p>some text here</p>';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<img><p>some text here<\/p>/);
                done();
            }).catch(done);
        });

        it('[failure] can handle <img> tag image without extension does not transform it', function (done) {
            var html = '<img src="http://example.com/content/images/large_img">';

            imageCachStub.returns(Promise.resolve({message: 'Image not found'}));
            converter.__set__('getCachedImageSize', imageCachStub);

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<img src="http:\/\/example.com\/content\/images\/large_img">/);
                done();
            }).catch(done);
        });

        it('[failure] can handle <img> that causes time out error and uses fallback image sizes', function (done) {
            var html = '<img src="http://example.com/content/images/large_img">';

            imageCachStub.returns(Promise.resolve({message: 'Request timed out'}));
            converter.__set__('getCachedImageSize', imageCachStub);

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<img src="http:\/\/example.com\/content\/images\/large_img">/);
                done();
            }).catch(done);
        });
    });

    describe('iframe tags', function () {
        it('[success] transforms <iframe> with only width property into <amp-iframe></amp-iframe> with full dimensions without overriding them', function (done) {
            var html = '<iframe src="https://www.youtube.com/embed/HMQkV5cTuoY" height="400"></iframe>';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-iframe src="https:\/\/www.youtube.com\/embed\/HMQkV5cTuoY" height="400" width="600" sandbox="allow-scripts allow-same-origin" layout="responsive"><\/amp-iframe>/);
                done();
            }).catch(done);
        });

        it('[success] adds \'https\' protocol to <iframe> if no protocol is supplied (e. e. giphy)', function (done) {
            var html = '<iframe src="//giphy.com/embed/3oEduKP4VaUxJvLwuA" width="480" height="372" frameBorder="0" class="giphy-embed" allowFullScreen></iframe>';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-iframe src="https:\/\/giphy.com\/embed\/3oEduKP4VaUxJvLwuA" width="480" height="372" frameborder="0" class="giphy-embed" allowfullscreen="" sandbox="allow-scripts allow-same-origin" layout="responsive"><\/amp-iframe>/);
                done();
            }).catch(done);
        });

        it('[success] adds \'https\' protocol to <iframe> if only \'http\' protocol is supplied', function (done) {
            var html = '<iframe src="http://giphy.com/embed/3oEduKP4VaUxJvLwuA" width="480" height="372" frameBorder="0" class="giphy-embed" allowFullScreen></iframe>' +
                       '<p><a href="http://giphy.com/gifs/afv-funny-fail-lol-3oEduKP4VaUxJvLwuA">via GIPHY</a></p></p>';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-iframe src="https:\/\/giphy.com\/embed\/3oEduKP4VaUxJvLwuA" width="480" height="372" frameborder="0" class="giphy-embed" allowfullscreen="" sandbox="allow-scripts allow-same-origin" layout="responsive"><\/amp-iframe><p><a href="http:\/\/giphy.com\/gifs\/afv-funny-fail-lol-3oEduKP4VaUxJvLwuA">via GIPHY<\/a><\/p><p><\/p>/);
                done();
            }).catch(done);
        });

        it('[success] can handle <iframe> tag without src and does not transform it', function (done) {
            var html = '<iframe>';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<iframe><\/iframe>/);
                done();
            }).catch(done);
        });
    });

    describe('audio tags', function () {
        it('[success] transforms <audio> with a fallback to <amp-audio>', function (done) {
            var html = '<audio src="http://foo.mp3" autoplay>Your browser does not support the <code>audio</code> element.</audio>';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-audio src="http:\/\/foo.mp3" autoplay="">Your browser does not support the <code>audio<\/code> element.<\/amp-audio>/);
                done();
            }).catch(done);
        });
        it('[success] transforms <audio> with a <source> tag to <amp-audio> and keeps the attributes', function (done) {
            var html = '<audio controls="controls" width="auto" height="50" autoplay="mobile">Your browser does not support the <code>audio</code> element.<source src="//foo.wav" type="audio/wav"></audio>';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-audio controls="controls" width="auto" height="50" autoplay="mobile">Your browser does not support the <code>audio<\/code> element.<source src="\/\/foo.wav" type="audio\/wav"><\/amp-audio>/);
                done();
            }).catch(done);
        });

        it('[success] transforms <audio> with a <track> tag to <amp-audio>', function (done) {
            var html = '<audio src="foo.ogg"><track kind="captions" src="https://foo.en.vtt" srclang="en" label="English"><track kind="captions" src="https://foo.sv.vtt" srclang="sv" label="Svenska"></audio>';

            converter(html).then(function (result) {
                should.exist(result);
                result.should.match(/<amp-audio src="foo.ogg"><track kind="captions" src="https:\/\/foo.en.vtt" srclang="en" label="English"><track kind="captions" src="https:\/\/foo.sv.vtt" srclang="sv" label="Svenska"><\/amp-audio>/);
                done();
            }).catch(done);
        });
    });
});
