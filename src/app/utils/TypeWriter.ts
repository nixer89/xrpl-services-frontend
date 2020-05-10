export class TypeWriter {

    currentIndex = 0;
    currentLength = 14;
    currentDir = true;

    constructor(private phrases, private callback) {
    }

    start() {
        this.next(2000);
    };

    next(waitTime) {
        let _this = this;
        setTimeout(function () {
            if (_this.currentDir)
                _this.currentLength--;
            else
                _this.currentLength++;
            var waitMs = _this.currentDir ? 40 : 20+Math.random()*70;
            var doContinue = true;
            if (!_this.currentDir && _this.currentLength == _this.phrases[_this.currentIndex].length) {
                _this.currentDir = true;
                waitMs = 3000;
                if (_this.currentIndex == _this.phrases.length-1)
                    doContinue = false;
            }
            else if (_this.currentDir && _this.currentLength == 0) {
                _this.currentDir = false;
                _this.currentIndex = (_this.currentIndex + 1) % _this.phrases.length;
            }
            var isWhole = _this.currentLength == _this.phrases[_this.currentIndex].length;
            _this.callback(
                _this.phrases[_this.currentIndex].substr(0, _this.currentLength) + ((isWhole || _this.currentLength==0) ? '' : '\u007C'));
            if (doContinue)
                _this.next(waitMs);
        }, waitTime);
    }
}
