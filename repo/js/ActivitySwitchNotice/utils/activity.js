const config = {
    activityNameList: (settings.activityNameList ? settings.activityNameList.splice('|') : []),
    activityKey: (settings.activityKey ? settings.activityKey : 'F5'),
}


function activityMain() {
    if (config.activityNameList.length<=0){
        //通知所有
    }else {
        //通知指定
    }
}

this.activityUtil = {
    activityMain,
}
