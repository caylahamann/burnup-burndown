import React from "react";
import {
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import { AutoSizer } from "nr1";
import { sub, lightFormat, add } from "date-fns";

//email to log into jira
const JIRA_EMAIL = "";
//api key
const KEY = "";

const daysBetweenTwoDates = (start, end) => {
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const transformResponseToStoryPoints = (data) => {
  const { issues } = data;
  return issues.reduce((acc, { fields }) => {
    return fields.customfield_10003 + acc;
  }, 0);
};

const jiraSearchQueryForToday = async ({ jiraEpic, status }) => {
  const queryString = `cf[11700]=${jiraEpic} AND status = \"${status}\"`;
  const headers = new Headers();
  headers.set("Authorization", `Basic ${btoa(`${JIRA_EMAIL}:${KEY}`)}`);
  headers.set("Accept", "application/json");
  const resp = await fetch(
    `http://localhost:8080/newrelic.atlassian.net/rest/api/2/search?jql=${encodeURIComponent(
      queryString
    )}&fields=status,customfield_10003`,
    {
      method: "GET",
      headers: headers,
    }
  );
  const body = await resp.json();

  return transformResponseToStoryPoints(body);
};

const jiraSearchQuery = async ({ jiraEpic, status, date }) => {
  const queryString = `cf[11700]=${jiraEpic} AND status WAS \"${status}\" ON \"${date}\ 22:00"`;
  const headers = new Headers();
  headers.set(
    "Authorization",
    `Basic ${btoa("chamann@newrelic.com:o9EOJ5iy54YksLahr7W6DB36")}`
  );
  headers.set("Accept", "application/json");
  const resp = await fetch(
    `http://localhost:8080/newrelic.atlassian.net/rest/api/2/search?jql=${encodeURIComponent(
      queryString
    )}&fields=status,customfield_10003`,
    {
      method: "GET",
      headers: headers,
    }
  );

  const body = await resp.json();

  return transformResponseToStoryPoints(body);
};

export default class BurndownBurnupVisualization extends React.Component {
  state = {
    data: [],
  };

  buildJiraData = async ({ startDate, endDate, jiraEpic }) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const numDaysToNow = daysBetweenTwoDates(start, new Date());
    const numDaysForMMF = daysBetweenTwoDates(start, end) + 1;
    const percentageIncreaseEachDay = 1 / numDaysForMMF;
    const array = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

    Promise.all(
      array.map(async (val, i) => {
        if (numDaysToNow - 1 - i > 0) {
          const dateSubtracted = sub(new Date(), {
            days: numDaysToNow - 1 - i,
          });
          const date = lightFormat(dateSubtracted, "yyyy/MM/dd");
          const dateFormattedForYAxis = lightFormat(
            dateSubtracted,
            "MM/dd/yyyy"
          );

          const [inProgress, readyForReview, toDo, blocked, done] =
            await Promise.all([
              jiraSearchQuery({ jiraEpic, status: "In Progress", date }),
              jiraSearchQuery({ jiraEpic, status: "Ready for Review", date }),
              jiraSearchQuery({ jiraEpic, status: "To Do", date }),
              jiraSearchQuery({ jiraEpic, status: "Blocked", date }),
              jiraSearchQuery({ jiraEpic, status: "Done", date }),
            ]);
          const totalPoints =
            inProgress + readyForReview + toDo + blocked + done;
          const expectedPointsFinished =
            percentageIncreaseEachDay * (i + 1) * totalPoints;
          return {
            Date: dateFormattedForYAxis,
            "In Progress": inProgress,
            "Ready for Review": readyForReview,
            "To Do": toDo,
            Blocked: blocked,
            Done: done,
            Expected: expectedPointsFinished,
          };
        } else if (numDaysToNow - 1 - i === 0) {
          const [inProgress, readyForReview, toDo, blocked, done] =
            await Promise.all([
              jiraSearchQueryForToday({ jiraEpic, status: "In Progress" }),
              jiraSearchQueryForToday({ jiraEpic, status: "Ready for Review" }),
              jiraSearchQueryForToday({ jiraEpic, status: "To Do" }),
              jiraSearchQueryForToday({ jiraEpic, status: "Blocked" }),
              jiraSearchQueryForToday({ jiraEpic, status: "Done" }),
            ]);
          const dateFormattedForYAxis = lightFormat(new Date(), "MM/dd/yyyy");
          const totalPoints =
            inProgress + readyForReview + toDo + blocked + done;
          const expectedPointsFinished =
            percentageIncreaseEachDay * (i + 1) * totalPoints;
          return {
            Date: dateFormattedForYAxis,
            "In Progress": inProgress,
            "Ready for Review": readyForReview,
            "To Do": toDo,
            Blocked: blocked,
            Done: done,
            Expected: expectedPointsFinished,
          };
        } else {
          const dateAdded = add(new Date(), {
            days: Math.abs(numDaysToNow + 1 - i),
          });
          const [inProgress, readyForReview, toDo, blocked, done] =
            await Promise.all([
              jiraSearchQueryForToday({ jiraEpic, status: "In Progress" }),
              jiraSearchQueryForToday({ jiraEpic, status: "Ready for Review" }),
              jiraSearchQueryForToday({ jiraEpic, status: "To Do" }),
              jiraSearchQueryForToday({ jiraEpic, status: "Blocked" }),
              jiraSearchQueryForToday({ jiraEpic, status: "Done" }),
            ]);
          const dateFormattedForYAxis = lightFormat(dateAdded, "MM/dd/yyyy");
          const totalPoints =
            inProgress + readyForReview + toDo + blocked + done;
          const expectedPointsFinished =
            percentageIncreaseEachDay * (i + 1) * totalPoints;
          return {
            Date: dateFormattedForYAxis,
            "In Progress": 0,
            "Ready for Review": 0,
            "To Do": 0,
            Blocked: 0,
            Done: 0,
            Expected: expectedPointsFinished,
          };
        }
      })
    ).then((data) => this.setState({ data }));
  };

  async componentDidMount() {
    await this.buildJiraData({
      startDate: "04-09-2021",
      endDate: "04-23-2021",
      jiraEpic: "DEVEX-1690",
    });
  }

  render() {
    const { data } = this.state;

    if (!data.length) {
      return null;
    }

    // const start = new Date('04-09-2021');
    // const end = new Date('04-23-2021');
    // const numDaysForMMF = daysBetweenTwoDates(start, end) + 1;

    const dataFiltered = data.filter(
      (dat) => dat["Date"] !== "04/17/2021" && dat["Date"] !== "04/18/2021"
    );

    return (
      <AutoSizer>
        {({ width, height }) => (
          <ComposedChart
            width={width}
            height={height}
            data={dataFiltered}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <XAxis dataKey="Date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="To Do" stackId="a" fill="#6D9EEB" />
            <Bar dataKey="In Progress" stackId="a" fill="#93C47D" />
            <Bar dataKey="Ready for Review" stackId="a" fill="#FFD966" />
            <Bar dataKey="Blocked" stackId="a" fill="#E06666" />
            <Bar dataKey="Done" stackId="a" fill="#CCCCCC" />
            <Line
              type="monotone"
              dataKey="Expected"
              stroke="#8E7CC3"
              strokeWidth={3}
            />
          </ComposedChart>
        )}
      </AutoSizer>
    );
  }
}
