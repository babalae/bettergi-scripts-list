

class _Artifact {
    constructor(arr) {
        this.number = parseInt(arr.shift())
        this.name = arr.shift()
        this.slot = arr.shift()
        this.main = arr.shift()
        this.mainVal = arr.shift().replace(',', '')
        const last = arr.pop()
        if (last.includes('已装备')) {
            this.equip = last.replace('已装备', '')
        }
        const index = findIndex(arr, '2件套')
        arr = arr.slice(0, index)
        this.setType = arr.pop().replace(/[:：]/, '')
        this.getStar()
        this.getSource(arr)
        this.getLv(arr)
        this.getAttr(arr)
    }

    getStar() {
        const { setType } = this
        if (STAR_3_SET_TYPE.includes(setType)) this.star = 3
        else if (STAR_4_SET_TYPE.includes(setType)) this.star = 4
        else this.star = 5
    }
    getSource(arr) {
        if (findIndex(arr, '祝圣之霜定义') !== -1) this.source = 'SEDefinition'
    }

    getLv(arr) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].startsWith('+')) {
                let str = arr.splice(i, 1)[0]
                this.lv = str.replace('+', '') || 0
            }
        }
    }

    getAttr(arr) {
        let r = []
        for (let i = 0; i < arr.length; i++) {
            let str = arr[i]
            for (let n of ATTR_NAMES) {
                if (str.includes(n)) {
                    let t = {}
                    if (str.includes('待激活')) {
                        t['active'] = false
                    }
                    if (str.includes('%') && ['攻击力', '防御力', '生命值'].includes(n)) {
                        t['isPercent'] = true
                    }
                    t[n] = str.match(/\+([.0-9%]+)/)[1]
                    r.push(t)
                }
            }
        }
        this.attr = r
    }
}


function findIndex(arr, target) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].includes(target)) return i
    }
    return -1
}

var Artifact = _Artifact

