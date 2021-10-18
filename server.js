const express = require("express");

// Constants
const PORT = 8080;

const app = express();

app.use(express.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

var mysql = require("mysql");

const forumUrl = "https://hdhog.forum24.ru/";
const connection = mysql.createConnection({
  host: "db",
  port: "3306",
  user: "root",
  password: "123456",
  database: "xammp",
  multipleStatements: true,
});

app.get("/", async (req, res) => {
  res.send("Hi");
});

app.get("/categories", async (req, res) => {
  const query = await generateCategoriesCreateSQL();
  res.send(query);
});

app.post("/categories", function (req, res) {
  connection.query(req.body.query, null, function (err, resp) {
    if (err) {
      console.log(err);
    }
    // if there are no errors send an OK message.
    res.send(resp);
  });
});

app.listen(PORT);
console.log(`Running on ${PORT}`);

const axios = require("axios").default;
const cheerio = require("cheerio");
const Iconv = require("iconv").Iconv;

async function getCategoriesObjectFromForum() {
  const config = {
    method: "get",
    url: forumUrl,
    responseEncoding: "binary",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36",
    },
  };

  return axios(config)
    .then(async (body) => {
      const html = decode(body.data);

      const $ = cheerio.load(html, { decodeEntities: false });
      const rows = [];

      $("#content-table-main > tbody > tr > td > table > tbody > tr").each(
        (i, row) => {
          const name = $(row).find("[colspan=5] b").text();
          const isCategory = !!name.length;

          if (isCategory) {
            rows.push({
              name,
              isCategory: true,
              forums: [],
            });
          } else {
            const name = $(row).find(".font3 > a b").text();

            if (name) {
              const icon = $(row).find("td > img").attr("src").toString();
              const isClosed =
                icon.includes("co.gif") || icon.includes("cn.gif");

              const postsAmount = $($(row).find("td")[2]).text();
              const topicsAmount = $($(row).find("td")[3]).text();

              rows[rows.length - 1].forums.push({
                name,
                isCategory: false,
                isClosed,
                postsAmount,
                topicsAmount,
                url: $(row).find(".font3 a").attr("href"),
                description: $(row)
                  .find(".font3 .font2")
                  .text()
                  .replace(/\n\t/g, "")
                  .split(".- ")[0],
              });
            }
          }
        }
      );

      return rows;
    })
    .catch(error);
}

async function generateCategoriesCreateSQL() {
  let query = "";
  const categories = await getCategoriesObjectFromForum();

  categories
    .map((category) => prepareCategorySQL(category))
    .forEach((category) => (query += category));

  return query;
}

function prepareCategorySQL(category) {
  const forums = category.forums.map((forum, i) => {
    return `(
            @category_left_id + ${2 * i + 1},
            @category_left_id + ${2 * i + 2},
            @category_id,
            '',
            '${forum.name}',
            '${forum.description}',
            7,0,7,0,1,0,0,0,0,48,1,1,1,0,0,7,7,1,1,0,0,
            ${forum.postsAmount},0,0,
            ${forum.topicsAmount},0,0,0,7,1,0,''
        )`;
  });

  const forumsRights = category.forums.map((forum, i) => {
    return `(
            2,
            @category_id+${i + 1},
            0,
            15,
            0
        )`;
  });

  const sql = `SET @category_name := '${category.name}';

SELECT MAX(right_id) FROM phpbb_forums INTO @latest_right_id;

SET @category_left_id := @latest_right_id+1;
SET @category_right_id := @category_left_id+${category.forums.length * 2 + 1};

INSERT INTO phpbb_forums (
    left_id,
    right_id,
    forum_parents,
    forum_name,
    forum_desc,
    forum_desc_options,
    forum_style,
    forum_rules_options,
    forum_topics_per_page,
    forum_type,
    forum_status,
    forum_last_post_id,
    forum_last_poster_id,
    forum_last_post_time,
    forum_flags,
    display_on_index,
    enable_indexing,
    enable_icons,
    enable_prune,
    prune_next,
    prune_days,
    prune_viewed,
    prune_freq,
    display_subforum_list,
    display_subforum_limit,
    forum_options,
    forum_posts_approved,
    forum_posts_unapproved,
    forum_posts_softdeleted,
    forum_topics_approved,
    forum_topics_unapproved,
    forum_topics_softdeleted,
    enable_shadow_prune,
    prune_shadow_days,
    prune_shadow_freq,
    prune_shadow_next,
    forum_rules
) VALUES (
    @category_left_id,
    @category_right_id,
    '',
    @category_name,
    '',
    7,
    0,
    7,
    0,
    0,
    0,
    0,
    0,
    0,
    32,
    1,
    1,
    1,
    0,
    0,
    7,
    7,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    7,
    1,
    0,
    ''
);

SELECT LAST_INSERT_ID() INTO @category_id;

INSERT INTO phpbb_acl_groups(
    group_id,
    forum_id,
    auth_option_id,
    auth_role_id,
    auth_setting
) VALUES (
    2,
    @category_id,
    0,
    15,
    0
);

INSERT INTO phpbb_forums(
    left_id,
    right_id,
    parent_id,
    forum_parents,
    forum_name,
    forum_desc,
    forum_desc_options,
    forum_style,
    forum_rules_options,
    forum_topics_per_page,
    forum_type,
    forum_status,
    forum_last_post_id,
    forum_last_poster_id,
    forum_last_post_time,
    forum_flags,
    display_on_index,
    enable_indexing,
    enable_icons,
    enable_prune,
    prune_next,
    prune_days,
    prune_viewed,
    prune_freq,
    display_subforum_list,
    display_subforum_limit,
    forum_options,
    forum_posts_approved,
    forum_posts_unapproved,
    forum_posts_softdeleted,
    forum_topics_approved,
    forum_topics_unapproved,
    forum_topics_softdeleted,
    enable_shadow_prune,
    prune_shadow_days,
    prune_shadow_freq,
    prune_shadow_next,
    forum_rules
)
VALUES ${forums.join(",")};

INSERT INTO phpbb_acl_groups(
    group_id,
    forum_id,
    auth_option_id,
    auth_role_id,
    auth_setting
) VALUES ${forumsRights.join(",")};

    `;

  return sql;
}

function decode(body) {
  let result = new Buffer.from(body, "binary");
  const conv = Iconv("windows-1251", "utf8");
  result = conv.convert(result).toString();
  return result;
}

function error(err) {
  console.log(err);
}
