// 本次识别快照：固定路径覆盖写入，不读取或合并上次运行的数据。
export const recognitionResultPath = "recognition-result.json";
let snapshot;

async function save() {
    snapshot.updatedAt = new Date().toISOString();
    const written = await file.writeText(recognitionResultPath, JSON.stringify(snapshot, null, 2), false);
    if (written !== true) {
        throw new Error(`识别结果写入未成功: ${recognitionResultPath}`);
    }
}

export async function beginRecognitionRun() {
    const startedAt = new Date().toISOString();
    snapshot = {
        schemaVersion: 1,
        runId: startedAt,
        startedAt,
        updatedAt: startedAt,
        finishedAt: null,
        status: "running",
        stage: "init",
        error: null,
        sections: {}
    };
    for (const name of ["mapMission", "holyRelics", "dailyCommission", "longTermTrainingPoints", "campaignArea", "activity"]) {
        snapshot.sections[name] = {status: "pending", data: null, reason: null};
    }
    // 必须先使旧结果失效；失败时中止，不能继续产生无法保存的新结果。
    await save();
}

export async function recordRecognition(name, data, status = "observed", reason = null) {
    snapshot.sections[name] = {status, data, reason};
    await save();
}

export async function runRecognitionStage(name, action) {
    snapshot.stage = name;
    snapshot.sections[name].status = "running";
    await save();
    const result = await action();
    if (snapshot.sections[name].status === "running") {
        await recordRecognition(name, null, "unknown", "流程返回但没有可确认的识别数据");
    }
    return result;
}

export async function finishRecognitionRun(error = null) {
    snapshot.status = error ? "failed" : "completed";
    snapshot.error = error ? String(error.message || error) : null;
    snapshot.finishedAt = new Date().toISOString();
    // completed 仅表示业务流程结束；每项是否识别到数据仍以各自状态为准。
    for (const section of Object.values(snapshot.sections)) {
        if (section.status === "running") {
            section.status = error ? "failed" : "unknown";
            section.reason = snapshot.error;
        } else if (section.status === "pending") {
            section.status = "not_run";
            section.reason = "本次流程未执行到此项";
        }
    }
    await save();
}
