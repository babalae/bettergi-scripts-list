#include <windows.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>

// 编译命令：gcc overlay.c -fexec-charset=UTF-8 -mcmodel=small -static -O3 -DNDEBUG -s -flto=auto -Wl,--gc-sections,--as-needed -o overlay.exe -lgdi32

BOOL RunAsAdmin() {
	wchar_t szPath[MAX_PATH];
	if (GetModuleFileNameW(NULL, szPath, ARRAYSIZE(szPath))) {
		SHELLEXECUTEINFOW sei = { sizeof(SHELLEXECUTEINFOW) };
		sei.lpVerb = L"runas"; // 关键：请求提升权限
		sei.lpFile = szPath;
		sei.hwnd = NULL;
		sei.nShow = SW_NORMAL;
		if (ShellExecuteExW(&sei)) {
			ExitProcess(0); // 成功启动新实例后退出当前进程
			return TRUE;
		}
	}
	return FALSE;
}

// 检查当前是否管理员权限
BOOL IsUserAdmin() {
	BOOL isAdmin = FALSE;
	PSID pAdminGroup = NULL;
	// 创建管理员组的SID
	SID_IDENTIFIER_AUTHORITY NtAuthority = SECURITY_NT_AUTHORITY;
	if (AllocateAndInitializeSid(&NtAuthority, 2,
		SECURITY_BUILTIN_DOMAIN_RID, DOMAIN_ALIAS_RID_ADMINS,
		0, 0, 0, 0, 0, 0, &pAdminGroup)) {
		// 检查令牌是否包含管理员组
		if (!CheckTokenMembership(NULL, pAdminGroup, &isAdmin)) isAdmin = FALSE;
		FreeSid(pAdminGroup);
	}
	return isAdmin;
}

BOOL PerformPrivilegedOperation() {
	if (!IsUserAdmin()) { // 先检查当前权限
		if (RunAsAdmin()) {
			return TRUE; // 已触发UAC提示，等待重启
		} else {
			// 处理用户拒绝或错误
			MessageBoxW(NULL, L"需要管理员权限才能继续", L"权限错误", MB_ICONERROR);
			return FALSE;
		}
	}
	return TRUE;
}


char *utf16_to_utf8(const wchar_t *input) {
	char *Buffer;
	int BuffSize = 0, Result = 0;
	BuffSize = WideCharToMultiByte(CP_UTF8, 0, input, -1, NULL, 0, NULL, NULL);
	Buffer = (char*) malloc(sizeof(char) * BuffSize);
	if(Buffer) {
		Result = WideCharToMultiByte(CP_UTF8, 0, input, -1, Buffer, BuffSize, NULL, NULL);
		if((Result > 0) && (Result <= BuffSize)) return Buffer;
		free(Buffer);
	}
	return NULL;
}

wchar_t *utf8_to_utf16(const char *input) {
	wchar_t *Buffer;
	int BuffSize = 0, Result = 0;
	BuffSize = MultiByteToWideChar(CP_UTF8, 0, input, -1, NULL, 0);
	Buffer = (wchar_t*) malloc(sizeof(wchar_t) * BuffSize);
	if(Buffer) {
		Result = MultiByteToWideChar(CP_UTF8, 0, input, -1, Buffer, BuffSize);
		if((Result > 0) && (Result <= BuffSize)) return Buffer;
		free(Buffer);
	}
	return NULL;
}

int utf8_printf(const char *format, ...) {
	DWORD NUM;
	int ret = -1;
	HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
	va_list args;
	va_start(args, format);
	if(hOut == NULL || hOut == INVALID_HANDLE_VALUE || !GetConsoleMode(hOut, &NUM)) {
		ret = vprintf(format, args);
		va_end(args);
		return ret;
	}
	char *buffer = (char*)malloc(16384);
	if(buffer == NULL) return ret;
	va_list args_copy;
	va_copy(args_copy, args);
	ret = vsnprintf(buffer, 16384, format, args);
	va_end(args);
	if(ret >= 16384) {
		free(buffer);
		buffer = (char*)malloc(++ret);
		ret = vsnprintf(buffer, ret, format, args_copy);
	}
	va_end(args_copy);
	if(ret < 0) {
		free(buffer);
		return ret;
	}
	wchar_t *buffer_utf16 = utf8_to_utf16(buffer);
	free(buffer);
	if(buffer_utf16 == NULL) return -1;
	BOOL VAL = WriteConsoleW(hOut, buffer_utf16, (DWORD)wcslen(buffer_utf16), &NUM, NULL);
	free(buffer_utf16);
	if(!VAL) return -1;
	return NUM;
}

// 设置控制台字体
BOOL SetConsoleFont(HANDLE hOutput, COORD fontSize, const wchar_t* fontName) {
	CONSOLE_FONT_INFOEX cfi;
	ZeroMemory(&cfi, sizeof(cfi));
	cfi.cbSize = sizeof(cfi);
	cfi.dwFontSize = fontSize;
	wcscpy_s(cfi.FaceName, LF_FACESIZE, fontName);

	// 设置字体样式
	cfi.FontWeight = FW_NORMAL;
	cfi.FontFamily = FF_DONTCARE;

	return SetCurrentConsoleFontEx(hOutput, FALSE, &cfi);
}

#define INTERVAL_MS 50
#define DELIMITER "----------------"

// 全局变量用于控制程序运行状态
volatile BOOL g_bRunning = TRUE;
HANDLE g_hExitEvent = NULL;

// 控制台事件处理函数
BOOL WINAPI ConsoleHandler(DWORD dwCtrlType) {
	switch (dwCtrlType) {
	case CTRL_CLOSE_EVENT:
	case CTRL_BREAK_EVENT:
	case CTRL_SHUTDOWN_EVENT:
		g_bRunning = FALSE;
		if (g_hExitEvent) {
			SetEvent(g_hExitEvent);
		}
		// 给主线程一点时间清理资源
		Sleep(50);
		return TRUE;
	default:
		return FALSE;
	}
}

// 获取当前 exe 所在目录的路径
char* get_exe_dir() {
	static char path[MAX_PATH];
	GetModuleFileName(NULL, path, MAX_PATH);
	// 去除文件名，只保留目录部分
	char* last_slash = strrchr(path, '\\');
	if (last_slash) {
		*(last_slash + 1) = '\0';
	}
	return path;
}

// 读取整个文件内容，调用者需负责释放返回的字符串
char* read_file(const char* filepath) {
	FILE* file = fopen(filepath, "rb");
	if (!file) {
		return NULL;
	}
	fseek(file, 0, SEEK_END);
	long size = ftell(file);
	fseek(file, 0, SEEK_SET);
	char* content = (char*)malloc(size + 1);
	if (content) {
		fread(content, 1, size, file);
		content[size] = '\0';
	}
	fclose(file);
	return content;
}

// 检查字符串是否以指定的分隔符结尾
int ends_with(const char* str, const char* suffix) {
	if (!str || !suffix) return 0;
	size_t len_str = strlen(str);
	size_t len_suffix = strlen(suffix);
	if (len_suffix > len_str) return 0;
	return strncmp(str + len_str - len_suffix, suffix, len_suffix) == 0;
}

int main() {
	if(!PerformPrivilegedOperation()) return 1;// 以管理员模式启动
	if(!SetProcessDPIAware()) return 1;// 设置DPI感知
	// 设置窗口位置和大小 (x, y, width, height)
	// 设置字体为宋体, 高度 25px
	COORD fontSize = {0, 20};
	HDC hdc = GetDC(NULL);
	if (!hdc) return 1;
	fontSize.Y = fontSize.Y * 96.0 / GetDeviceCaps(hdc, LOGPIXELSY);
	int posX = 1320 * GetDeviceCaps(hdc, DESKTOPHORZRES) / 1920;// 桌面水平分辨率
	int posY = 680 * GetDeviceCaps(hdc, DESKTOPVERTRES) / 1080;// 桌面垂直分辨率
	ReleaseDC(NULL, hdc);
	DWORD console_mode;
	HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
	if (hOut == NULL || hOut == INVALID_HANDLE_VALUE) return 1;
	// 设置控制台字体大小
	if(!SetConsoleFont(hOut, fontSize, L"SimHei")) SetConsoleFont(hOut, fontSize, L"SimSun");
	if (!GetConsoleMode(hOut, &console_mode)) return 1;
	// 设置控制台启用虚拟终端模式
	SetConsoleMode(hOut, console_mode | ENABLE_PROCESSED_OUTPUT | ENABLE_VIRTUAL_TERMINAL_PROCESSING);
	// 获取控制台窗口句柄
	HWND hwnd = GetConsoleWindow();
	SetWindowPos(hwnd, HWND_TOPMOST, posX, posY, 600, 300, SWP_SHOWWINDOW);

	// 创建退出事件对象
	g_hExitEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
	if (!g_hExitEvent) {
		return 2;
	}

	// 注册控制台事件处理程序
	if (!SetConsoleCtrlHandler(ConsoleHandler, TRUE)) {
		CloseHandle(g_hExitEvent);
		return 3;
	}

	// 1. 获取 overlay.txt 的绝对路径
	char filepath[MAX_PATH];
	snprintf(filepath, sizeof(filepath), "%soverlay.txt", get_exe_dir());

	char* last_content = NULL; // 保存上一次以分隔符结尾的内容
	char* current_content = NULL;

	while (g_bRunning) {
		// 2. 读取文件
		current_content = read_file(filepath);
		if (current_content != NULL) {
			// 3. 检查是否以分隔符结尾
			if (ends_with(current_content, DELIMITER)) {
				// 4. 与上一次内容比较
				if (last_content == NULL || strcmp(current_content, last_content) != 0) {
					// 5. 若不同，则输出
					char* last_break = strrchr(current_content, '\n');
					if (last_break) *last_break = '\0';
					utf8_printf("\033[2J\033[H%s\n", current_content);// 清屏并输出
					if (last_break) *last_break = '\n';
					// 更新 last_content
					if (last_content) {
						free(last_content);
					}
					last_content = current_content;
				} else {
					free(current_content);
				}
			} else {
				free(current_content);
			}
		}
		// 6. 睡眠 50ms，但可被退出事件唤醒
		WaitForSingleObject(g_hExitEvent, INTERVAL_MS);
	}

	// 清理资源
	if (last_content) {
		free(last_content);
	}
	if (g_hExitEvent) {
		CloseHandle(g_hExitEvent);
	}

	return 0;
}
