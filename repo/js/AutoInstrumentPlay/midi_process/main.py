from sys import exit
from argparse import ArgumentParser, ArgumentTypeError
from music import music_gen, detailed_midi_analysis
from mido import MidiFile


def instrument_choose(value):
    if value is None:
        return 0, {0: None}
    ivalue = int(value[0])
    mode_mapping = {0: "乐器0", 1: "乐器1", 2: "乐器2", 3: "乐器3"}

    if ivalue not in mode_mapping:
        raise ArgumentTypeError(
            f"无效的模式值: {value}。可用值: {list(mode_mapping.keys())}"
        )

    return ivalue, mode_mapping


def add_argument():
    parser = ArgumentParser()
    # 可选参数
    parser.add_argument("--report", "-r", action="store_true", help="生成MIDI报告")

    parser.add_argument("--file", "-f", type=str, help="MIDI文件目录", default=None)
    parser.add_argument("--channels", "-c", type=list, help="通道选择", default=[])
    parser.add_argument("--threshold", "-t", type=int, help="响度二值化", default=64)
    parser.add_argument(
        "--instrument",
        "-i",
        type=instrument_choose,
        help="乐器选择\n1:001\n2:002\n3:003",
        default=None,
    )

    return parser.parse_args()


def music_file(file_path, channel_list, threshold, instrument):
    res = music_gen(file_path, channel_list, threshold)
    instrument = instrument[1][instrument[0]]
    if instrument is None:
        print("warn: 未选择乐器")
    else:
        match instrument:
            case "乐器0":
                print("MIDI音符转换为乐器0按键")
            case _:
                print(f"{instrument}尚未支持")
        pass
    with open("music_output.txt", "w+", encoding="utf-8") as file:
        for note in res:
            file.write(f"{note}\n")


def filter_and_convert_to_int(string_list):
    result = []
    for s in string_list:
        try:
            # 尝试将字符串转换为整数
            num = int(s)
            result.append(num)
        except ValueError:
            # 如果转换失败，跳过该字符串
            continue
    return result


if __name__ == "__main__":
    args = add_argument()
    file_path = args.file.replace("\\", "/")
    channels = filter_and_convert_to_int(args.channels)
    threshold = args.threshold
    isReport = args.report
    instrument = instrument_choose(args.instrument)

    print(f"MIDI文件目录 file: {file_path}")
    print(f"通道选择 channels: {channels}")
    print(f"响度二值化 threshold: {threshold}")
    print(f"生成MIDI报告 report: {isReport}")
    print(f"转换MIDI音乐 music: {not isReport}")
    print(f"乐器选择 instrument: {instrument[1][instrument[0]]}")

    if isReport:
        detailed_midi_analysis(file_path)
        exit(0)
    if channels == []:
        print("warn: 未选择通道, 可以通过生成MIDI报告查看通道信息")
        exit(0)
    if not (0 < threshold and threshold < 127):
        print("warn: 非法的响度阈值, 请重新输入1-126的合法输入")
        exit(0)
    try:
        MidiFile(file_path)
    except OSError:
        print("error: 错误的文件, 请重新选择")

    music_file(file_path, channels, threshold, instrument)
    print("MIDI音乐转换完成, 输出至music_output.txt")
