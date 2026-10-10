
"use strict";

/* =========================================
   Smart Exam BD
   Supabase-backed practice quiz
========================================= */

const SUBJECTS = {
  6: ["বাংলা", "ইংরেজি", "গণিত", "বিজ্ঞান"],
  7: ["বাংলা", "ইংরেজি", "গণিত", "বিজ্ঞান"],
  8: ["বাংলা", "ইংরেজি", "গণিত", "বিজ্ঞান"],
  9: ["বাংলা", "ইংরেজি", "গণিত", "বিজ্ঞান", "বাংলাদেশ ও বিশ্বপরিচয়"],
  10: ["বাংলা", "ইংরেজি", "গণিত", "বিজ্ঞান", "বাংলাদেশ ও বিশ্বপরিচয়"]
};

const GROUP_SUBJECTS = {
  "বিজ্ঞান": ["পদার্থবিজ্ঞান", "রসায়ন", "জীববিজ্ঞান", "উচ্চতর গণিত"],
  "মানবিক": ["ভূগোল ও পরিবেশ", "ইতিহাস", "পৌরনীতি"],
  "ব্যবসায় শিক্ষা": ["হিসাববিজ্ঞান", "ফিন্যান্স ও ব্যাংকিং", "ব্যবসায় উদ্যোগ"]
};

const OPTION_LABELS = ["ক", "খ", "গ", "ঘ"];

const $ = (id) => document.getElementById(id);

const classSelect = $("class-select");
const groupSelect = $("group-select");
const groupField = $("group-field");
const subjectSelect = $("subject-select");
const durationSelect = $("duration-select");

const setupPanel = $("setup-panel");
const quizPanel = $("quiz-panel");
const resultPanel = $("result-panel");

const startButton = $("start-btn");
const previousButton = $("previous-btn");
const nextButton = $("next-btn");
const submitButton = $("submit-btn");
const quitButton = $("quit-btn");
const retryButton = $("retry-btn");

let questions = [];
let answers = [];
let currentIndex = 0;
let secondsRemaining = 0;
let timerId = null;
let examFinished = false;
let examSettings = null;

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

/* ---------- General helpers ---------- */

function showMessage(message, isError = true) {
  const element = $("setup-message");
  element.textContent = message;
  element.style.color = isError ? "#b83b3b" : "#236b50";
}

function clearMessage() {
  showMessage("", false);
}

function shuffleArray(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function toBanglaDigits(value) {
  const digits = "০১২৩৪৫৬৭৮৯";
  return String(value).replace(/[0-9]/g, digit => digits[digit]);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0")
  );
}

function showPanel(panelToShow) {
  [setupPanel, quizPanel, resultPanel].forEach(panel => {
    panel.classList.add("hidden");
  });

  panelToShow.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getSelectedGroup() {
  if (Number(classSelect.value) >= 9) {
    return groupSelect.value;
  }

  return "";
}

/* ---------- Subject selection ---------- */

function updateSubjectList() {
  const selectedClass = Number(classSelect.value);
  const group = getSelectedGroup();

  subjectSelect.innerHTML = "";
  subjectSelect.disabled = true;

  const placeholder = document.createElement("option");
  placeholder.value = "";

  if (!selectedClass) {
    placeholder.textContent = "আগে শ্রেণি নির্বাচন করো";
    subjectSelect.appendChild(placeholder);
    return;
  }

  if (selectedClass >= 9 && !group) {
    placeholder.textContent = "আগে বিভাগ নির্বাচন করো";
    subjectSelect.appendChild(placeholder);
    return;
  }

  placeholder.textContent = "বিষয় নির্বাচন করো";
  subjectSelect.appendChild(placeholder);

  let subjects = [...(SUBJECTS[selectedClass] || [])];

  if (selectedClass >= 9 && GROUP_SUBJECTS[group]) {
    subjects = subjects.concat(GROUP_SUBJECTS[group]);
  }

  subjects.forEach(subject => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    subjectSelect.appendChild(option);
  });

  subjectSelect.disabled = false;
}

function handleClassChange() {
  const selectedClass = Number(classSelect.value);
  const needsGroup = selectedClass >= 9;

  groupField.classList.toggle("hidden", !needsGroup);
  groupSelect.required = needsGroup;

  if (!needsGroup) {
    groupSelect.value = "";
  }

  updateSubjectList();
  clearMessage();
}

function applyClassFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const classFromUrl = params.get("class");

  if (["6", "7", "8", "9", "10"].includes(classFromUrl)) {
    classSelect.value = classFromUrl;
    handleClassChange();
  }
}

/* ---------- Supabase connection ---------- */

function validateConfiguration() {
  if (!window.supabase) {
    throw new Error(
      "Supabase লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করো।"
    );
  }

  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    throw new Error(
      "Supabase সংযোগ সেট করা হয়নি। supabase-config.js-এ Project URL ও Publishable Key বসাও।"
    );
  }
}

/* ---------- Load questions ---------- */

async function loadQuestions(classLevel, subject) {
  validateConfiguration();

  const { data, error } = await supabaseClient
    .from("exam_questions")
    .select(
      "id, class_level, subject, chapter, question, options, correct_option, explanation"
    )
    .eq("class_level", classLevel)
    .eq("subject", subject)
    .eq("is_published", true);

  if (error) {
    console.error("Supabase query error:", error);

    throw new Error(
      "প্রশ্ন লোড করা যায়নি। ডেটাবেজের টেবিল, RLS policy ও key পরীক্ষা করো।"
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "এই শ্রেণি ও বিষয়ের জন্য এখনো প্রকাশিত প্রশ্ন নেই। Supabase-এ প্রশ্ন যোগ করো।"
    );
  }

  for (const item of data) {
    if (
      !Array.isArray(item.options) ||
      item.options.length !== 4 ||
      !Number.isInteger(item.correct_option) ||
      item.correct_option < 0 ||
      item.correct_option > 3
    ) {
      throw new Error(
        "ডেটাবেজে একটি প্রশ্নের অপশন বা সঠিক উত্তরের তথ্য ভুল আছে।"
      );
    }
  }

  return shuffleArray(data);
}

/* ---------- Start the exam ---------- */

async function startExam() {
  if (examFinished) {
    examFinished = false;
  }

  clearMessage();

  const classLevel = Number(classSelect.value);
  const group = getSelectedGroup();
  const subject = subjectSelect.value;
  const durationMinutes = Number(durationSelect.value);

  if (!classLevel || !subject) {
    showMessage("পরীক্ষা শুরু করার আগে শ্রেণি ও বিষয় নির্বাচন করো।");
    return;
  }

  if (classLevel >= 9 && !group) {
    showMessage("নবম ও দশম শ্রেণির জন্য বিভাগ নির্বাচন করো।");
    return;
  }

  if (![5, 10, 15, 30].includes(durationMinutes)) {
    showMessage("পরীক্ষার সময় সঠিকভাবে নির্বাচন করো।");
    return;
  }

  startButton.disabled = true;
  startButton.textContent = "প্রশ্ন লোড হচ্ছে...";

  try {
    const loadedQuestions = await loadQuestions(classLevel, subject);

    questions = loadedQuestions;
    answers = new Array(questions.length).fill(null);
    currentIndex = 0;
    secondsRemaining = durationMinutes * 60;
    examFinished = false;

    examSettings = {
      classLevel,
      group,
      subject,
      durationMinutes
    };

    $("quiz-subject-label").textContent =
      `শ্রেণি ${toBanglaDigits(classLevel)} • ${subject}`;

    $("quiz-title").textContent = "অনুশীলন পরীক্ষা";
    $("timer").textContent = formatTime(secondsRemaining);

    showPanel(quizPanel);
    renderQuestion();
    startTimer();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "একটি সমস্যা হয়েছে। আবার চেষ্টা করো।");
  } finally {
    startButton.disabled = false;
    startButton.textContent = "পরীক্ষা শুরু করো →";
  }
}

/* ---------- Render a question ---------- */

function renderQuestion() {
  if (!questions.length || currentIndex < 0) return;

  const item = questions[currentIndex];

  $("question-count").textContent =
    `প্রশ্ন ${toBanglaDigits(currentIndex + 1)} / ${toBanglaDigits(questions.length)}`;

  $("answered-count").textContent =
    `উত্তর দেওয়া হয়েছে: ${toBanglaDigits(answers.filter(a => a !== null).length)}`;

  $("progress-bar").style.width =
    `${((currentIndex + 1) / questions.length) * 100}%`;

  $("question-text").textContent = item.question;

  const optionsList = $("options-list");
  optionsList.innerHTML = "";

  item.options.forEach((optionText, optionIndex) => {
    const label = document.createElement("label");
    label.className = "option-item";

    if (answers[currentIndex] === optionIndex) {
      label.classList.add("selected");
    }

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "question-option";
    input.value = String(optionIndex);
    input.checked = answers[currentIndex] === optionIndex;

    input.addEventListener("change", () => {
      answers[currentIndex] = optionIndex;
      renderQuestion();
    });

    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = OPTION_LABELS[optionIndex] + ".";

    const text = document.createElement("span");
    text.textContent = optionText;

    label.append(input, letter, text);
    optionsList.appendChild(label);
  });

  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === questions.length - 1;

  nextButton.textContent =
    currentIndex === questions.length - 1
      ? "শেষ প্রশ্ন"
      : "পরের প্রশ্ন →";
}

/* ---------- Navigation ---------- */

function nextQuestion() {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
  }
}

function previousQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

/* ---------- Countdown timer ---------- */

function startTimer() {
  stopTimer();

  timerId = window.setInterval(() => {
    if (examFinished) {
      stopTimer();
      return;
    }

    secondsRemaining--;
    $("timer").textContent = formatTime(Math.max(secondsRemaining, 0));

    if (secondsRemaining <= 0) {
      stopTimer();
      finishExam(true);
    }
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

/* ---------- Submit and calculate result ---------- */

function finishExam(autoSubmitted = false) {
  if (examFinished || !questions.length) return;

  if (!autoSubmitted) {
    const unanswered = answers.filter(answer => answer === null).length;

    if (unanswered > 0) {
      const confirmed = window.confirm(
        `তুমি ${toBanglaDigits(unanswered)}টি প্রশ্নের উত্তর দাওনি। তবুও কি পরীক্ষা জমা দিতে চাও?`
      );

      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        "তুমি কি নিশ্চিত যে পরীক্ষা জমা দিতে চাও?"
      );

      if (!confirmed) return;
    }
  }

  examFinished = true;
  stopTimer();

  const correct = answers.reduce((count, answer, index) => {
    return count + (answer === questions[index].correct_option ? 1 : 0);
  }, 0);

  const skipped = answers.filter(answer => answer === null).length;
  const wrong = questions.length - correct - skipped;
  const percentage = questions.length
    ? Math.round((correct / questions.length) * 100)
    : 0;

  $("result-summary").textContent = autoSubmitted
    ? "সময় শেষ হওয়ায় তোমার পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হয়েছে।"
    : "তোমার পরীক্ষার ফলাফল ও উত্তর পর্যালোচনা নিচে দেওয়া হলো।";

  $("score-value").textContent =
    `${toBanglaDigits(correct)} / ${toBanglaDigits(questions.length)}`;

  $("percentage-value").textContent = `${toBanglaDigits(percentage)}%`;
  $("score-bar").style.width = `${percentage}%`;

  $("correct-value").textContent = toBanglaDigits(correct);
  $("wrong-value").textContent = toBanglaDigits(wrong);
  $("skipped-value").textContent = toBanglaDigits(skipped);

  renderReview();
  showPanel(resultPanel);
}

function renderReview() {
  const reviewList = $("review-list");
  reviewList.innerHTML = "";

  questions.forEach((item, index) => {
    const chosen = answers[index];
    const correct = item.correct_option;
    const isCorrect = chosen === correct;

    const card = document.createElement("article");
    card.className = "review-item";

    const title = document.createElement("h4");
    title.textContent =
      `${toBanglaDigits(index + 1)}. ${item.question}`;

    const yourAnswer = document.createElement("p");
    yourAnswer.className = "review-answer";

    if (chosen === null) {
      yourAnswer.textContent = "তোমার উত্তর: দেওয়া হয়নি";
    } else {
      yourAnswer.textContent =
        `তোমার উত্তর: ${OPTION_LABELS[chosen]}. ${item.options[chosen]}`;
    }

    if (chosen !== null) {
        yourAnswer.classList.add(isCorrect ? "correct" : "wrong");
      }

    const correctAnswer = document.createElement("p");
    correctAnswer.className = "review-answer correct";
    correctAnswer.textContent =
      `সঠিক উত্তর: ${OPTION_LABELS[correct]}. ${item.options[correct]}`;

    const explanation = document.createElement("p");
    explanation.className = "review-explanation";
    explanation.textContent = item.explanation
      ? `ব্যাখ্যা: ${item.explanation}`
      : "এই প্রশ্নের ব্যাখ্যা যোগ করা হয়নি।";

    card.append(title, yourAnswer, correctAnswer, explanation);
    reviewList.appendChild(card);
  });
}

/* ---------- Reset / quit ---------- */

function resetExam() {
  stopTimer();

  questions = [];
  answers = [];
  currentIndex = 0;
  secondsRemaining = 0;
  examFinished = false;
  examSettings = null;

  showPanel(setupPanel);
  clearMessage();
}

function quitExam() {
  const confirmed = window.confirm(
    "পরীক্ষা ছেড়ে দিলে বর্তমান উত্তরগুলো হারিয়ে যাবে। তুমি কি নিশ্চিত?"
  );

  if (confirmed) {
    resetExam();
  }
}

/* ---------- Event listeners ---------- */

classSelect.addEventListener("change", handleClassChange);
groupSelect.addEventListener("change", updateSubjectList);

startButton.addEventListener("click", startExam);
previousButton.addEventListener("click", previousQuestion);
nextButton.addEventListener("click", nextQuestion);
submitButton.addEventListener("click", () => finishExam(false));
quitButton.addEventListener("click", quitExam);
retryButton.addEventListener("click", resetExam);

/* ---------- Initial page state ---------- */

handleClassChange();
applyClassFromUrl();
