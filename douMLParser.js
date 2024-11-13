const puppeteer = require("puppeteer-core");
const fs = require("fs");
const { Document, Packer, Paragraph, TextRun } = require("docx");

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

const urls = {
  "dou-ai/ml-5+": "https://jobs.dou.ua/vacancies/?category=AI%2FML&exp=5plus",
  "dou-ai/ml-0-1": "https://jobs.dou.ua/vacancies/?category=AI%2FML&exp=0-1",
  "dou-ai/ml-1-3": "https://jobs.dou.ua/vacancies/?category=AI%2FML&exp=1-3",
  "dou-ai/ml-3-5": "https://jobs.dou.ua/vacancies/?category=AI%2FML&exp=3-5",
};

const parseAPage = async (url, category, browser) => {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 0 });

  try {
    while (await page.$(".more-btn a")) {
      try {
        await page.waitForSelector(".more-btn a", {
          visible: true,
          timeout: 3000,
        });
        await page.click(".more-btn a");
        await delay(1000);
      } catch (error) {
        break;
      }
    }
  } catch {}

  await delay(2000);

  const links = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("li.l-vacancy"));
    return items
      .map((item) => {
        const titleElement = item.querySelector(".title a");
        return titleElement ? titleElement.href : null;
      })
      .filter((link) => link !== null);
  });

  const vacancies = [];

  for (const link of links) {
    const vacancyPage = await browser.newPage();
    await vacancyPage.goto(link, { waitUntil: "load", timeout: 0 });

    const vacancyDetails = await vacancyPage.evaluate(() => {
      const title = document.querySelector(".g-h2")?.innerText || "";
      const info = document.querySelector(".sh-info")?.innerText || "";
      const section =
        document.querySelector(".vacancy-section")?.innerText || "";
      return { title, info, section };
    });

    vacancies.push({ link, ...vacancyDetails });

    await vacancyPage.close();
  }

  const sections = vacancies.map((vacancy, index) => ({
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: `Vacancy ${index + 1}`, bold: true, size: 28 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Link: ${vacancy.link}`, underline: true }),
        ],
      }),
      new Paragraph({
        text: `Title: ${vacancy.title}`,
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: `Info: ${vacancy.info}`,
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: `Description: ${vacancy.section}`,
        spacing: { after: 400 },
      }),
    ],
  }));

  const doc = new Document({
    creator: "Vacancy Scraper",
    sections,
  });

  const sanitizedCategory = category.replace(/[\/+]/g, "_");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(`${sanitizedCategory}Vacancies.docx`, buffer);
};

const fireParser = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  for (const [category, url] of Object.entries(urls)) {
    await parseAPage(url, category, browser);
  }

  await browser.close();
};

fireParser();
