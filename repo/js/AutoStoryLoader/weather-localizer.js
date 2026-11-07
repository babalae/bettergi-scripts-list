// Standalone minimap recognizer for the MapBack_07 outdoor layer.
// Uses only BetterGI's public OpenCvSharp/Mat/image APIs; no game input.
// Adds contrast-normalized retry for dynamic snow/cloud and camera overlays.
function createWeatherLocalizer(assetDir) {
    const cv = OpenCvSharp.OpenCvSharp;
    let coarse = null, fine = null, contrastCoarse = null, wideContrastCoarse = null;
    function scope() {
        const resources = [];
        return {
            keep(x) { resources.push(x); return x; },
            input(x) { return this.keep(cv.InputArray.Create(x)); },
            output(x) { return this.keep(cv.OutputArray.Create(x)); },
            close() { for (let i = resources.length - 1; i >= 0; --i) resources[i].Dispose(); }
        };
    }
    function gray(src, s) {
        if (src.Channels() === 1) return src;
        return s.keep(src.CvtColor(src.Channels() === 4 ? cv.ColorConversionCodes.BGRA2GRAY : cv.ColorConversionCodes.BGR2GRAY));
    }
    function highpass(src, sigma, s) {
        const f = s.keep(new Mat());
        src.ConvertTo(s.output(f), cv.MatType.CV_32FC1);
        const blurred = s.keep(f.GaussianBlur(new cv.Size(0, 0), sigma));
        const result = new Mat();
        cv.Cv2.Subtract(s.input(f), s.input(blurred), s.output(result));
        return result;
    }
    function load() {
        if (coarse) return;
        const s = scope();
        try {
            const c = s.keep(file.ReadImageMatSync(assetDir + '/MapBack_07_color.webp'));
            const f = s.keep(file.ReadImageMatSync(assetDir + '/MapBack_07_gray.webp'));
            fine = gray(f, s).Clone();
            coarse = highpass(gray(c, s), 4, s);
        } finally { s.close(); }
    }
    function normalized(src, sigma, s) {
        const f=s.keep(new Mat());
        src.ConvertTo(s.output(f),cv.MatType.CV_32FC1);
        const mean=s.keep(f.GaussianBlur(new cv.Size(0,0),sigma));
        const squared=s.keep(new Mat()),meanSquared=s.keep(new Mat());
        cv.Cv2.Multiply(s.input(f),s.input(f),s.output(squared));
        cv.Cv2.Multiply(s.input(mean),s.input(mean),s.output(meanSquared));
        const variance=s.keep(squared.GaussianBlur(new cv.Size(0,0),sigma));
        cv.Cv2.Subtract(s.input(variance),s.input(meanSquared),s.output(variance));
        const zero=s.keep(new Mat(src.Height,src.Width,cv.MatType.CV_32FC1,cv.Scalar.All(0)));
        const noiseFloor=s.keep(new Mat(src.Height,src.Width,cv.MatType.CV_32FC1,cv.Scalar.All(9)));
        cv.Cv2.Max(s.input(variance),s.input(zero),s.output(variance));
        cv.Cv2.Add(s.input(variance),s.input(noiseFloor),s.output(variance));
        cv.Cv2.Sqrt(s.input(variance),s.output(variance));
        const result=new Mat();
        cv.Cv2.Subtract(s.input(f),s.input(mean),s.output(result));
        cv.Cv2.Divide(s.input(result),s.input(variance),s.output(result));
        return result;
    }
    function locate(g, mask, s, useContrast, contrastSigma = 2) {
        if (useContrast && !(contrastSigma === 3 ? wideContrastCoarse : contrastCoarse)) {
            // Derive this pyramid directly from the fine map, at exactly 1/5.
            const reduced=s.keep(fine.Resize(new cv.Size(0,0),.2,.2,cv.InterpolationFlags.Area));
            const filtered = normalized(reduced,contrastSigma,s);
            if (contrastSigma === 3) wideContrastCoarse = filtered; else contrastCoarse = filtered;
        }
        const filter=useContrast?normalized:highpass;
        const small=s.keep(g.Resize(new cv.Size(52,52),0,0,cv.InterpolationFlags.Area));
        const smallMask=s.keep(mask.Resize(new cv.Size(52,52),0,0,cv.InterpolationFlags.Nearest));
        const template=s.keep(filter(small,useContrast?contrastSigma:4,s));
        const train=useContrast?(contrastSigma === 3 ? wideContrastCoarse : contrastCoarse):coarse;
        const scores=s.keep(train.MatchTemplate(s.input(template),cv.TemplateMatchModes.CCoeffNormed,s.input(smallMask)));
        const best=peak(scores,s);
        const rx=Math.max(0,best.x-10),ry=Math.max(0,best.y-10);
        const exclusion=s.keep(new Mat(scores,new cv.Rect(rx,ry,Math.min(scores.Width,best.x+11)-rx,Math.min(scores.Height,best.y+11)-ry)));
        exclusion.SetTo(cv.Scalar.All(-1));
        const runnerUp=peak(scores,s);
        const roughX=(best.x+26)*5,roughY=(best.y+26)*5;
        if (best.score<.60 || best.score-runnerUp.score<.15) {
            return {ok:false,reason:'coarse_ambiguous',score:best.score,runnerUp:runnerUp.score};
        }
        if (roughX<230 || roughY<230 || roughX+230>fine.Width || roughY+230>fine.Height) {
            return {ok:false,reason:'outside_supported_interior'};
        }
        const region=s.keep(new Mat(fine,new cv.Rect(roughX-230,roughY-230,460,460)));
        const filtered=s.keep(filter(region,useContrast?contrastSigma*5:20,s));
        const reference=s.keep(new Mat(filtered,new cv.Rect(80,80,300,300)));
        const enlarged=s.keep(g.Resize(new cv.Size(260,260),0,0,cv.InterpolationFlags.Cubic));
        const fineTemplate=s.keep(filter(enlarged,useContrast?contrastSigma*5:20,s));
        const fineMask=s.keep(mask.Resize(new cv.Size(260,260),0,0,cv.InterpolationFlags.Nearest));
        const exactScores=s.keep(reference.MatchTemplate(s.input(fineTemplate),cv.TemplateMatchModes.CCoeffNormed,s.input(fineMask)));
        const exact=peak(exactScores,s);
        if (exact.score<.60) return {ok:false,reason:'fine_mismatch',score:exact.score};
        return {ok:true,X:9216-(roughX-20+exact.x),Y:11264-(roughY-20+exact.y),score:best.score,runnerUp:runnerUp.score,exactScore:exact.score,method:useContrast?'local-contrast':'highpass',contrastSigma:useContrast?contrastSigma:null};
    }
    function iconMask(bgr, s) {
        const channels = cv.Cv2.Split(bgr);
        for (let i = 0; i < channels.Length; ++i) s.keep(channels[i]);
        const mx=s.keep(new Mat()), mn=s.keep(new Mat()), diff=s.keep(new Mat()), eq=s.keep(new Mat());
        const constant = v => s.keep(new Mat(156,156,cv.MatType.CV_8UC1,cv.Scalar.All(v)));
        cv.Cv2.Max(s.input(channels[0]),s.input(channels[1]),s.output(mx));
        cv.Cv2.Max(s.input(mx),s.input(channels[2]),s.output(mx));
        cv.Cv2.Min(s.input(channels[0]),s.input(channels[1]),s.output(mn));
        cv.Cv2.Min(s.input(mn),s.input(channels[2]),s.output(mn));
        cv.Cv2.Compare(s.input(mx),s.input(mn),s.output(eq),cv.CmpType.EQ);
        const mid=s.keep(mx.InRange(cv.Scalar.All(50),cv.Scalar.All(127)));
        cv.Cv2.BitwiseAnd(s.input(eq),s.input(mid),s.output(eq));
        cv.Cv2.Subtract(s.input(mx),s.input(mn),s.output(diff));
        cv.Cv2.Subtract(s.input(constant(255)),s.input(mx),s.output(mn));
        cv.Cv2.Divide(s.input(mn),s.input(constant(6)),s.output(mn));
        cv.Cv2.Min(s.input(mn),s.input(diff),s.output(diff));
        cv.Cv2.Add(s.input(diff),s.input(constant(10)),s.output(diff));
        mx.SetTo(cv.Scalar.All(255),eq);
        cv.Cv2.Divide(s.input(mx),s.input(diff),s.output(mx),10);
        const mask=s.keep(mx.Threshold(200,255,cv.ThresholdTypes.Binary));
        const kernel=s.keep(cv.Cv2.GetStructuringElement(cv.MorphShapes.Ellipse,new cv.Size(5,5)));
        cv.Cv2.Dilate(s.input(mask),s.output(mask),s.input(kernel));
        cv.Cv2.MorphologyEx(s.input(mask),s.output(mask),cv.MorphTypes.Close,s.input(kernel));
        cv.Cv2.BitwiseNot(s.input(mask),s.output(mask));
        const circle=constant(0);
        circle.Circle(new cv.Point(78,78),76,cv.Scalar.All(255),-1);
        circle.Circle(new cv.Point(78,78),12,cv.Scalar.All(0),-1);
        cv.Cv2.BitwiseAnd(s.input(mask),s.input(circle),s.output(mask));
        return mask;
    }
    function peak(scores, s) {
        const valid=s.keep(scores.InRange(cv.Scalar.All(-1),cv.Scalar.All(1)));
        const minValue=host.newVar(host.toDouble(0)), maxValue=host.newVar(host.toDouble(0));
        const minPoint=host.newVar(cv.Point), maxPoint=host.newVar(cv.Point);
        scores.MinMaxLoc(minValue.out,maxValue.out,minPoint.out,maxPoint.out,s.input(valid));
        return {score:Number(maxValue.value),x:Number(maxPoint.value.X),y:Number(maxPoint.value.Y)};
    }
    function match(src) {
        load();
        const s=scope();
        try {
            const scale=src.Width/1920;
            if (Math.abs(src.Height/1080-scale)>.01) throw new Error('定位采样需要16:9游戏画面');
            const crop=s.keep(new Mat(src,new cv.Rect(Math.round(90*scale),Math.round(47*scale),Math.round(156*scale),Math.round(156*scale))));
            let bgr=s.keep(crop.Resize(new cv.Size(156,156),0,0,cv.InterpolationFlags.Area));
            if (bgr.Channels()===4) bgr=s.keep(bgr.CvtColor(cv.ColorConversionCodes.BGRA2BGR));
            const mask=iconMask(bgr,s), g=gray(bgr,s);
            const first=locate(g,mask,s,false);
            if (first.ok) return first;
            const retry=locate(g,mask,s,true);
            if (retry.ok) return retry;
            // Local clouds can hide one half while the other still has terrain.
            // Require two separately searched halves to agree, each meeting the
            // same score and uniqueness thresholds as the full minimap.
            const halves=[
                {name:'top',remove:new cv.Rect(0,78,156,78)},
                {name:'bottom',remove:new cv.Rect(0,0,156,78)},
                {name:'left',remove:new cv.Rect(78,0,78,156)},
                {name:'right',remove:new cv.Rect(0,0,78,156)}
            ];
            const accepted=[];
            for (const contrastSigma of [2, 3]) {
            if (contrastSigma === 3) {
                // Wider local contrast scale recovers terrain hidden by the
                // endpoint snow. All original score/uniqueness gates still apply.
                const wide = locate(g,mask,s,true,3);
                if (wide.ok) return wide;
            }
            for (const half of halves) {
                const partial=s.keep(mask.Clone());
                const excluded=s.keep(new Mat(partial,half.remove));
                excluded.SetTo(cv.Scalar.All(0));
                // Prevent a tiny surviving icon or patch from carrying the vote.
                if (cv.Cv2.CountNonZero(s.input(partial)) < 156*156*.22) continue;
                const p=locate(g,partial,s,true,contrastSigma);
                if (!p.ok) continue;
                for (const previous of accepted) {
                    if (previous.part !== half.name && Math.hypot(p.X-previous.X,p.Y-previous.Y)<=2) {
                        const chosen=p.exactScore>previous.exactScore?p:previous;
                        chosen.method='local-contrast-parts';
                        chosen.support=[previous.part,half.name];
                        return chosen;
                    }
                }
                p.part=half.name;
                // The same half at two scales is one observation, not two votes.
                const duplicate = accepted.findIndex(q => q.part === p.part && Math.hypot(p.X-q.X,p.Y-q.Y)<=2);
                if (duplicate < 0) accepted.push(p);
                else if (p.exactScore > accepted[duplicate].exactScore) accepted[duplicate] = p;
            }
            }
            retry.firstAttempt=first;
            retry.partialMatches=accepted;
            return retry;
        } finally { s.close(); }
    }
    return {match,dispose(){if(coarse)coarse.Dispose();if(fine)fine.Dispose();if(contrastCoarse)contrastCoarse.Dispose();if(wideContrastCoarse)wideContrastCoarse.Dispose();coarse=null;fine=null;contrastCoarse=null;wideContrastCoarse=null;}};
}
