# Operating Systems schedule sync

This Google Apps Script syncs NYU CSCI-UA.0202 Fall 2026 from:
https://cs.nyu.edu/~mwalfish/classes/26fa/syllabus.html

## Set up Google Calendar and Tasks

Use the same Google account for Calendar, Tasks, and the Apps Script project. There are two separate destinations named **Operating Systems**: a calendar for quizzes/exams and a task list for homework/labs. If either already exists, reuse it instead of creating a duplicate.

### Create the calendar

1. On a computer, open [Google Calendar](https://calendar.google.com/).
2. In the left sidebar, click **+** next to **Other calendars**, then **Create new calendar**.
3. Enter **Operating Systems** as the name, with that exact capitalization and spacing.
4. Set its time zone to **America/New_York (Eastern Time)** and click **Create calendar**.
5. Return to the calendar view. Under **My calendars**, make sure **Operating Systems** is checked so its events are visible.

The calendar must exist before the first sync. The script finds it by name; it does not create it automatically. You do not need to make it public or share it.

### Create the task list

1. In Google Calendar, click the **Tasks** icon in the right sidebar.
2. At the top of the Tasks panel, click the arrow beside the current list name.
3. Select **Create a new list**.
4. Enter **Operating Systems** and click **Done**.

Creating the task list manually is optional: the script creates it automatically if it does not exist. If you already have a list with this name, use that list.

### Show both on your calendar

In Google Calendar's left sidebar, enable both **Tasks** and **Operating Systems**. Homework and labs belong to the task list and appear through Calendar's Tasks display; quizzes and exams belong to the separate Operating Systems calendar. Creating the calendar alone does not create the task list.

Google's setup guides: [Create a calendar](https://support.google.com/calendar/answer/37095?hl=en) and [Create a task list](https://support.google.com/tasks/answer/7675771?co=GENIE.Platform%3DDesktop&hl=en).

## Install once

1. Open https://script.google.com/ while signed into the Google account with your Operating Systems calendar. Create a New project and name it Operating Systems Schedule Sync.
2. Replace the contents of Code.gs with the included Code.gs file.
3. Open Project Settings (gear). Enable “Show appsscript.json manifest file in editor.” Return to the editor and replace appsscript.json with the included file. Save. This configures New York time and adds the Tasks and Calendar advanced services.
4. If you use a custom Google Cloud project, enable Google Tasks API and Google Calendar API in that project's Cloud console. With the default Apps Script Cloud project, adding the advanced services enables their APIs automatically.
5. Select previewSchedule in the function dropdown and click Run. Complete Google's authorization flow. The execution log shows the parsed schedule; this function does not create tasks or calendar events.
6. Select installDailySync and click Run. It performs the first sync immediately, then creates a daily trigger for approximately 6–7 AM America/New_York. You do not need to deploy a web app or leave the browser open.
7. Open Google Calendar and ensure both Tasks and your Operating Systems calendar are visible. Check HW 4 and Quiz 4 against the current schedule. Completed tasks may be hidden by your Calendar display settings.

The script is supplied and locally tested, but has not been installed or authorized in your account.

## Behavior

- Homework and labs become date-only Google Tasks in the Operating Systems task list. The task list is created if absent.
- The existing Operating Systems calendar receives all-day quizzes and exams. The script does not create another calendar.
- The default imports the whole semester, including earlier deadlines. To avoid creating past items, change firstDate in Code.gs before the initial run to your desired YYYY-MM-DD start date. Keep that cutoff fixed afterward.
- Existing tasks are patched in place by stable assignment identity, independent of date and URL. Status and completion timestamps are never written. Completed and hidden tasks are included in lookups.
- Events are patched in place by stable assessment identity.
- A repeat run makes no writes when the source and managed fields are unchanged.
- Course updates override task titles, dates, and the generated description block. Personal notes added outside the bracketed block are preserved.
- Do not remove the bracketed sync marker from task notes. It is how the script finds the original task again.
- Only objects created by this script are managed. Existing manually entered tasks/events are not automatically matched or merged. If you have already entered these assignments, reconcile those duplicates after the first run.
- Tasks you delete manually will be recreated if the assignment remains on the schedule. Completing a task will not recreate it.
- Items disappearing from the schedule are retained at their last known date, with a description notice to verify with course staff. They are not deleted or automatically uncompleted. The notice clears if the item returns.
- Readings, release dates, exam reviews, and the undated exam-period heading do not create events or tasks.
- Assignment links are extracted from published anchors on the schedule and lab index. Lab 0 links to Lab Setup. Unpublished links are explicitly marked pending and filled in on later syncs. URLs for unpublished assignments are not guessed.
- The schedule page is the authority for dates; the lab index is used only to find assignment links.
- Unrecognized table layouts, conflicting dates, fetch failures, or duplicate managed identities cause an error. A malformed schedule is rejected before task/event writes. An API failure partway through a valid sync can leave a partial sync; rerun syncSchedule to finish.

## Calendar/list selection

If there are multiple lists or calendars with the same name, the script stops rather than guessing. Set taskListId and/or calendarId at the top of Code.gs if needed. Calendar IDs are in Google Calendar → Settings → Operating Systems → Integrate calendar → Calendar ID. Leave the names unchanged unless you want a different destination.

## Maintain or stop

- Run syncSchedule to refresh immediately.
- Run previewSchedule for a read-only source preview.
- Run installDailySync again to replace this project's daily trigger; it does not create duplicate triggers.
- Run removeDailySync to stop future refreshes while keeping all tasks/events.
- Use Apps Script → Executions to inspect errors. Installable trigger failures are reported through Apps Script's failure notification system; review the trigger's notification settings.
- Keep a single copy of this script project active. If the professor significantly changes the HTML layout or assessment naming, the parser may need updating. Do not reuse the Fall 2026 namespace for a different course/semester.

## Validation performed

Tested against the downloaded live schedule on September 29, 2026: 19 assignments (HW 1–13 and Lab 0–5), nine quizzes, and one midterm. No dated final exam was present. schedule-preview.json is a snapshot, not a schedule used by the daily sync.

Local mocked-API tests passed for first import, unchanged reruns, completed/hidden task rescheduling without status changes, preserving personal notes, quiz rescheduling, removed/reappearing assignments, malformed-source rejection, changed-column rejection, and date rollover. Live Google account writes still require your first authorized run.

## API references

Google Tasks task date and completion fields:
https://developers.google.com/workspace/tasks/reference/rest/v1/tasks

Including completed and hidden tasks:
https://developers.google.com/workspace/tasks/reference/rest/v1/tasks/list

Calendar event date-only start/end fields:
https://developers.google.com/workspace/calendar/api/v3/reference/events

Apps Script daily triggers:
https://developers.google.com/apps-script/guides/triggers/installable
