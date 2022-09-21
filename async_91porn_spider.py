# -*- coding: utf-8 -*-
import os
import re
import time
import sqlite3
import asyncio
import aiohttp
from aiohttp import TCPConnector
from asgiref.sync import sync_to_async
from aiohttp_retry import RetryClient, ExponentialRetry
import aiofiles
import threading
import stat


class Sqlite:
    def __init__(self):

        self.lock = threading.Lock()
        self.conn = sqlite3.connect('91.db', check_same_thread=False)
        self.cur = self.conn.cursor()
        self.cur.execute('''CREATE TABLE IF NOT EXISTS spider (
        ID INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        THEME_ID INT NOT NULL,
        THEME_TITLE CHAR(150) NOT NULL);''')
        self.conn.commit()

    async def aio_commit(self):
        await sync_to_async(self.conn.commit)()

    async def aio_exec(self, command):

        return await sync_to_async(self.cur.execute)(command)

    async def aio_topic_is_exist(self, topic_id):
        sql = f"select ID from spider where THEME_ID = '{topic_id}' limit 1"
        ret = await self.aio_exec(sql)
        for i in ret:
            return i

    def topic_is_exist(self, topic_id):
        sql = f"select ID from spider where THEME_ID = '{topic_id}' limit 1"
        self.cur.execute(sql)

    async def insert_topic(self, topic_id, topic_title):
        await self.aio_exec(f"insert into spider (THEME_ID,THEME_TITLE) values ({topic_id}, '{topic_title}')")
        await self.aio_commit()

    async def clean(self):
        if self.conn:
            await self.aio_commit()
            await sync_to_async(self.conn.close)()


class AsyncSpider(Sqlite):
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-TW;q=0.6',
            'Content-Type': 'text/html; charset=UTF-8',
            'Cookie': '__utmz=50351329.1619103318.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); cf_clearance=fe1ff244a0c09d9c94751debbf235924654ba65d-1622268711-0-150; __utmc=50351329; CLIPSHARE=dsk6btimjontv94uivjobd7q9g; __utma=50351329.1539335310.1619103318.1622270967.1622288651.6; __utmb=50351329.0.10.1622288651'
        }
        self.proxies = "http://127.0.0.1:10811"
        # self.main_url = "https://0831.91p51.live/"
        self.main_url = "http://91porn.com/"
        self.cdn_url = "https://cdn77.91p49.com//m3u8//"
        # self.cdn_url = "https://la2.killcovid2021.com//m3u8//"
        self.attempt_time = 10  # 个别文件下载不动的时候，继续下载的最大次数
        self.topic_storage = []
        # self.download_path = ".//"
        self.download_path = "D://91//"
        super().__init__()

    async def __aenter__(self):
        retry_options = ExponentialRetry(attempts=5)
        aio_session = aiohttp.ClientSession(connector=TCPConnector(limit=64, verify_ssl=False), headers=self.headers, )
        self.session = RetryClient(client_session=aio_session, retry_options=retry_options)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.session.close()

    @staticmethod
    def clean_folder(folder_path):

        if isinstance(folder_path, str):
            folder_path = [folder_path]

        for folder in folder_path:
            for root, dirs, files in os.walk(folder, topdown=False):
                for name in files:
                    file_name = os.path.join(root, name)
                    try:
                        os.unlink(file_name)
                    except PermissionError:
                        # 某些只读文件删不掉，需要先赋予 写 的权限，然后再删除
                        os.chmod(file_name, stat.S_IWRITE)
                        try:
                            os.unlink(file_name)
                        except Exception:
                            pass
                for name in dirs:
                    # 某些文件夹也删除不掉，譬如U盘的系统文件夹（保存U盘自身信息的文件夹）
                    try:
                        os.rmdir(os.path.join(root, name))
                    except Exception:
                        pass

    async def get_text(self, url):
        async with self.session.get(url, proxy=self.proxies) as ret:
            return await ret.text()

    async def get_file(self, url):
        async with self.session.get(url, proxy=self.proxies) as ret:

            return ret

    async def fetch_topic(self, url):
        print("获取主题列表：地址为{}".format(url))
        try:
            ret = await self.get_text(url)
        except Exception as e:
            print(e)
        else:
            print("获取主题列表成功:")
            pattern = re.compile(
                '.*?<img class="img-responsive" src=".*?/thumb/(.*?).jpg.*?m-t-5">(.*?)</span>.*?',
                re.S)
            themes = re.findall(pattern, ret)
            print(themes)
            self.topic_storage.extend(themes)

    async def construct_topic_storage(self, ini_url, page_num):
        tasks = [asyncio.create_task(self.fetch_topic(ini_url+str(i))) for i in range(1, int(page_num) + 1)]
        await asyncio.wait(tasks)

    async def split_m3u8(self, oid):
        ret = await self.get_text(f"{self.cdn_url}{oid}/{oid}.m3u8")
        ts_compile = re.compile(r'\d{7,}.ts')
        rest = re.findall(ts_compile, ret)
        return rest

    async def download_ts(self, url, path):
        resp = await self.session.get(url)
        video_bytes = await resp.read()
        if resp.status == 200:
            async with aiofiles.open(path, mode='wb') as f:
                await f.write(video_bytes)
            print(f"finish this part{path}")
        else:
            print("warning")

    async def merge_video(self, path: str, video_list: list, video_title: str):
        async with aiofiles.open(rf"{path}/{video_title}.mp4", mode='wb') as f:
            for item in video_list:
                if not os.path.exists(rf"{path}/{item}"):
                    topic_id = item.split(".")[0]
                    complete_flag = False
                    for _ in range(self.attempt_time):
                        await self.download_ts(f"{self.cdn_url}{topic_id}/{item}", rf"{path}/{item}")
                        if os.path.exists(rf"{path}/{item}"):
                            complete_flag = True
                            break
                    if not complete_flag:
                        print("无法下载该片段,即将删除整个主题")
                        await sync_to_async(self.clean_folder)(path)
                        return None
                else:
                    try:
                        async with aiofiles.open(rf"{path}/{item}", mode="rb") as q:
                            content = await q.read()
                            await f.write(content)
                    except FileNotFoundError:
                        print(rf"{path}/{item}，神奇了")
                        break

            print("合并文件")
        try:
            for i in video_list:
                await sync_to_async(os.remove)(rf"{path}/{i}")
            print(f"删除{path}ts文件")
        except FileNotFoundError:
            print("路径错误")

    async def download(self, topics):
        topic_id = topics[0]
        topic_title = topics[1].replace("/", "|").replace("\\", "|")
        topic_path = self.download_path + topic_title + "//"
        video_path = topic_path + topic_title + ".mp4"
        # 不存在主题文件夹路径，则直接创建一个文件夹
        if not os.path.exists(topic_path):
            os.makedirs(topic_path)
        # 如果数据库存在，则说明已经下载过了，跳过
        if self.topic_is_exist(topic_id):
            print("重复下载:" + topic_title + "--->将跳过该视频")

        else:
            # 数据不存在，但是路径下又存在该视频，说明这个视频没有下载完成，就删掉再下一次
            if os.path.exists(video_path):
                print("存在视频:" + topic_title + "--->删除后从新下载")
                os.remove(video_path)
            # 获取ts列表
            ts_list = await self.split_m3u8(topic_id)
            # 加入时间循环，同时下载
            tasks = [asyncio.create_task(self.download_ts(f"{self.cdn_url}{topic_id}/{item}",
                                                          f"{topic_path}/{item}")) for item in ts_list]
            await asyncio.wait(tasks)
            # 合并ts文件
            await self.merge_video(topic_path, ts_list, topic_title)


def main():
    st = time.time()
    
    async def aio_main():
        async with AsyncSpider() as spider:
            await spider.construct_topic_storage(spider.main_url+"v.php?category=hot&viewtype=basic&page=", 1)
            tasks = [asyncio.create_task(spider.download(item)) for item in spider.topic_storage]
            await asyncio.wait(tasks)
    asyncio.run(aio_main())
    print("本次任务结束，耗时：{}s".format(time.time() - st))


if __name__ == "__main__":
    main()
