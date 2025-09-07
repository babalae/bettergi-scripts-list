import math
from mido import MidiFile, tempo2bpm


def note(c, w, n, t):
    return f"[{c},{w},{n},{t}]"


def music_gen(midi_file_path, channel_list, threshold):
    mid = MidiFile(midi_file_path)
    ticks_per_beat = mid.ticks_per_beat

    # 构建 tempo_map，从所有轨道中收集速度事件
    tempo_map = []  # 列表元素为 (绝对ticks, tempo)
    # 默认速度500000微秒/四分音符（120 BPM）在ticks=0处
    tempo_map.append((0, 500000))

    # 遍历所有轨道收集速度事件
    for track in mid.tracks:
        abs_ticks = 0
        for msg in track:
            abs_ticks += msg.time
            if msg.is_meta and msg.type == "set_tempo":
                tempo_map.append((abs_ticks, msg.tempo))

    # 按绝对ticks排序tempo_map
    tempo_map.sort(key=lambda x: x[0])

    # 从所有轨道中收集指定通道的音符事件
    events = []  # 元素为 (绝对ticks, 类型, 音符, 力度, 通道)
    program_changes = {}  # 存储每个通道的音色设置: 通道 -> 程序号

    for track in mid.tracks:
        abs_ticks = 0
        for msg in track:
            abs_ticks += msg.time
            if not msg.is_meta:
                if msg.type == "program_change":
                    # 记录音色改变事件
                    program_changes[msg.channel] = msg.program
                elif (
                    msg.type == "note_on" or msg.type == "note_off"
                ) and msg.channel in channel_list:
                    # 只处理指定通道的音符事件
                    if msg.type == "note_on" and msg.velocity < threshold:
                        events.append(
                            (abs_ticks, "note_off", msg.note, msg.velocity, msg.channel)
                        )
                    elif msg.type == "note_on":
                        events.append(
                            (abs_ticks, "note_on", msg.note, msg.velocity, msg.channel)
                        )
                    else:
                        events.append(
                            (abs_ticks, "note_off", msg.note, msg.velocity, msg.channel)
                        )

    # 按绝对ticks排序事件
    events.sort(key=lambda x: x[0])

    # 配对音符事件：note_on和note_off
    active_notes = {}  # 字典: (通道, 音符) -> (开始ticks, 力度)
    note_list = []  # 列表元素: (开始ticks, 持续ticks, 音符, 通道)

    for event in events:
        abs_ticks, event_type, note_num, velocity, channel = event
        key = (channel, note_num)
        if event_type == "note_on":
            # 如果已有相同音符活跃，先结束它
            if key in active_notes:
                start_ticks_prev, vel_prev = active_notes[key]
                duration_ticks = abs_ticks - start_ticks_prev
                note_list.append((start_ticks_prev, duration_ticks, note_num, channel))
            active_notes[key] = (abs_ticks, velocity)
        elif event_type == "note_off":
            if key in active_notes:
                start_ticks_prev, vel_prev = active_notes[key]
                duration_ticks = abs_ticks - start_ticks_prev
                note_list.append((start_ticks_prev, duration_ticks, note_num, channel))
                del active_notes[key]

    # 忽略未结束的音符
    # 生成结果列表
    result = []
    for start_ticks, duration_ticks, note_num, channel in note_list:
        # 查找开始ticks对应的速度
        current_tempo = 500000
        for ticks, tempo in tempo_map:
            if ticks <= start_ticks:
                current_tempo = tempo
            else:
                break

        # 计算开始节拍数
        start_beats = start_ticks / ticks_per_beat
        c = math.floor(start_beats)
        # 计算每节拍的毫秒数
        ms_per_beat = current_tempo / 1000.0
        # 计算偏移毫秒数w
        w = (start_beats - c) * ms_per_beat
        w = int(round(w))
        # 计算持续时间t（毫秒）
        t = (duration_ticks / ticks_per_beat) * ms_per_beat
        t = int(round(t))

        # 生成字符串并添加到结果
        result.append(note(c, w, note_num, t))
    return result


def detailed_midi_analysis(midi_file_path):
    mid = MidiFile(midi_file_path)

    with open("midi_report_output.txt", "w", encoding="gb18030") as f:
        f.write(f"MIDI文件分析报告\n")
        f.write(f"================\n\n")
        f.write(f"文件类型: {mid.type}\n")
        f.write(f"每四分音符ticks数: {mid.ticks_per_beat}\n")
        f.write(f"轨道数量: {len(mid.tracks)}\n")
        f.write(f"总时长: {mid.length} 秒\n\n")

        for track_idx, track in enumerate(mid.tracks):
            f.write(f"\n轨道 {track_idx}: '{track.name}' 有 {len(track)} 条消息\n")
            f.write("-" * 50 + "\n")

            current_time = 0  # 当前累计时间(ticks)

            for msg in track:
                current_time += msg.time
                f.write(f"{current_time:8} ticks: ")

                if msg.is_meta:
                    # 元事件处理
                    if msg.type == "set_tempo":
                        tempo = tempo2bpm(msg.tempo)
                        f.write(f"元事件 - 设置速度: {tempo:.2f} BPM")
                    elif msg.type == "time_signature":
                        f.write(f"元事件 - 拍号: {msg.numerator}/{msg.denominator}")
                    elif msg.type == "key_signature":
                        f.write(f"元事件 - 调号: {msg.key}")
                    elif msg.type == "track_name":
                        f.write(f"元事件 - 轨道名称: '{msg.name}'")
                    elif msg.type == "end_of_track":
                        f.write("元事件 - 轨道结束")
                    else:
                        f.write(f"元事件 - {msg.type}: {msg}")
                else:
                    # MIDI通道事件处理
                    if msg.type == "note_on":
                        f.write(
                            f"音符开 - 通道{msg.channel} 音符{msg.note} 力度{msg.velocity}"
                        )
                    elif msg.type == "note_off":
                        f.write(
                            f"音符关 - 通道{msg.channel} 音符{msg.note} 力度{msg.velocity}"
                        )
                    elif msg.type == "control_change":
                        f.write(
                            f"控制改变 - 通道{msg.channel} 控制器{msg.control} 值{msg.value}"
                        )
                    elif msg.type == "program_change":
                        f.write(f"音色改变 - 通道{msg.channel} 程序{msg.program}")
                    else:
                        f.write(f"{msg}")

                f.write("\n")


if __name__ == "__main__":
    res = music_gen("midi_process/C418 - Cat(MIDI).mid", [2], 64)
    with open("example.txt", "w", encoding="utf-8") as file:
        for note in res:
            file.write(f"{note},\n")
