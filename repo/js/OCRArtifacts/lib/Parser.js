async function parse(filePath) {
    let content = file.readTextSync(filePath)
    content = content.replace(/=+第(\d*)个圣遗物信息:/g, ';;;;;$1')
    content = content.replace(/=+.*/g, '')
    const arr = content.split(';;;;;')
    const total = arr.shift().match(/圣遗物数量: (\d*),/)[1]
    log.info(`total: ${total}`)
    let result = []
    while (arr.length > 0) {
        result.push(new Artifact(arr.shift().trim().split('\n')))
    }
    let name = filePath.replace('artifact_log', 'parsed_result').replace('.txt', '.json')
    file.WriteTextSync(name, JSON.stringify(result, null, 2), true)
    log.info(`解析完成,请查看文件:  ${name}`)
    return new Promise((res, rej) => { res() })
}
