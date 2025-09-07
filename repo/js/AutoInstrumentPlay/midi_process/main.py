from sys import exit
from argparse import ArgumentParser
from music import music_gen, detailed_midi_analysis
from mido import MidiFile


def add_argument():
    parser = ArgumentParser()

    # 添加可选参数

    parser.add_argument("--channels", "-c", type=list, help="通道选择", default=[])
    parser.add_argument("--threshold", "-t", type=int, help="响度二值化", default=64)
    parser.add_argument("--file", "-f", type=str, help="MIDI文件目录", default=None)
    parser.add_argument("--report", "-r", action="store_true", help="生成MIDI报告")

    return parser.parse_args()


def music_file(file_path, channel_list, threshold):
    res = music_gen(file_path, channel_list, threshold)
    with open("music_output.txt", "w+", encoding="utf-8") as file:
        for note in res:
            file.write(f"{note}\n")


if __name__ == "__main__":
    args = add_argument()
    file_path = args.file.replace("\\", "/")
    channels = args.channels
    threshold = args.threshold
    isReport = args.report

    print(f"MIDI文件目录 file: {file_path}")
    print(f"通道选择 channels: {channels}")
    print(f"响度二值化 threshold: {threshold}")
    print(f"生成MIDI报告 report: {isReport}")
    print(f"转换MIDI音乐 music: {not isReport}")

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
    channels = [int(s) for s in channels if s.strip()]

    music_file(file_path, channels, 64)
    print("MIDI音乐转换完成, 输出至music_output.txt")
