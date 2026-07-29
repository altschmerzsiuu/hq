import asyncio
from playwright.async_api import async_playwright

async def test():
    print("Starting Playwright...")
    try:
        p = await async_playwright().start()
        print("Launching Chromium...")
        b = await p.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
        print("Chromium launched successfully!")
        page = await b.new_page()
        await page.set_content("<h1>Test</h1>")
        pdf = await page.pdf(format="A4")
        print("PDF generated successfully! Bytes size:", len(pdf))
        await b.close()
        await p.stop()
    except Exception as e:
        print("EXCEPTION OCCURRED:", e)

if __name__ == "__main__":
    asyncio.run(test())
