const { runAction, initAction } = require('./action')

const init = async function(){
    await initAction()
    await runAction()
}

init()