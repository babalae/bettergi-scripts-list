import os

path_names = os.listdir("pathing")
path_list = [f"\"{i.rstrip(".json")}\"" for i in path_names]
path_list_print = ",\n".join(path_list)
print(path_list_print)