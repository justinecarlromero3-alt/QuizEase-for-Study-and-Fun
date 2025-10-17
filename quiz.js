document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  window.grade = urlParams.get('grade');    // Use window.grade for global access
  window.strand = urlParams.get('strand');  // Use window.strand for global access

  const fileList = document.querySelector('.file-list');
  fileList.innerHTML = '';
  if (window.quizFiles[window.grade] && window.quizFiles[window.grade][window.strand]) {
    window.quizFiles[window.grade][window.strand].forEach(f => {
      const li = document.createElement('li');
      li.textContent = f.name;
      li.onclick = () => selectFile(f);  
      fileList.appendChild(li);
    });
    document.getElementById('fileSelection').style.display = 'block';
    document.getElementById('strandTitle').innerText = `Strand: ${window.strand} (Grade ${window.grade})`;
  }
  showProgress(); // Show progress/history on page load
});

let selectedFile = null;
let quizData = [];
let roundIndex = 0;
let questionIndex = 0;
let userAnswers = [];
let score = 0;
const rounds = ["Easy", "Average", "Difficult"];
const questionsPerRound = 10;
let timer = null;
let timeLeft = 30;

// Called when a module/lesson is selected
function selectFile(f) {
  selectedFile = f;
  document.getElementById('fileSelection').style.display = 'none';
  startQuiz(); 
}

// Core quiz logic
async function startQuiz() {
  quizData = await generateQuizQuestions();
  roundIndex = 0;
  questionIndex = 0;
  userAnswers = [];
  score = 0;
  showQuestion();
}

// Example: Generate questions (simple random, replace with AI or sample logic as needed)
async function generateQuizQuestions() {
  // You can integrate OpenAI or other logic here.
  let questions = [];
  for (let r = 0; r < rounds.length; r++) {
    for (let i = 1; i <= questionsPerRound; i++) {
      const typeIdx = Math.floor(Math.random() * 4);
      let type, options, answer;
      switch (typeIdx) {
        case 0: // MCQ
          type = "mcq";
          options = ["A", "B", "C", "D"];
          answer = options[Math.floor(Math.random() * 4)];
          break;
        case 1: // True/False
          type = "tf";
          options = ["True", "False"];
          answer = options[Math.floor(Math.random() * 2)];
          break;
        case 2: // Fill in the blank
          type = "blank";
          options = [];
          answer = "Sample";
          break;
        case 3: // Identification
          type = "id";
          options = [];
          answer = "Identification";
          break;
      }
      questions.push({
        round: rounds[r],
        question: `(${rounds[r]}) Sample Q${i} from ${selectedFile.name}?`,
        type,
        options,
        answer
      });
    }
  }
  return questions;
}

// Show a quiz question
function showQuestion() {
  document.getElementById('quizSection').style.display = 'block';
  document.getElementById('quizResult').style.display = 'none';
  const current = quizData[questionIndex];
  document.getElementById('quizRound').innerText = `Round: ${current.round} (${roundIndex+1}/3)`;
  document.getElementById('quizQuestion').innerText = current.question;
  const form = document.getElementById('quizForm');
  form.innerHTML = '';
  let input;
  if (current.type === "mcq") {
    current.options.forEach(opt => {
      const lbl = document.createElement('label');
      lbl.innerHTML = `<input type="radio" name="answer" value="${opt}">${opt}`;
      form.appendChild(lbl);
    });
  } else if (current.type === "tf") {
    ["True", "False"].forEach(opt => {
      const lbl = document.createElement('label');
      lbl.innerHTML = `<input type="radio" name="answer" value="${opt}">${opt}`;
      form.appendChild(lbl);
    });
  } else if (current.type === "blank" || current.type === "id") {
    input = document.createElement('input');
    input.type = "text";
    input.name = "answer";
    input.required = true;
    form.appendChild(input);
  }
  document.getElementById('nextBtn').style.display = 'inline-block';
  document.getElementById('nextBtn').onclick = submitAnswer;
  startTimer();
}

function startTimer() {
  timeLeft = 30;
  document.getElementById('timer').innerText = `Time: ${timeLeft}s`;
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').innerText = `Time: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      submitAnswer(true);
    }
  }, 1000);
}

function submitAnswer(isTimeout = false) {
  clearInterval(timer);
  const form = document.getElementById('quizForm');
  let ans = "";
  if (!isTimeout) {
    const fd = new FormData(form);
    ans = fd.get('answer') || "";
  }
  userAnswers.push(ans);
  // Simple scoring logic
  if (
    ans &&
    (
      (quizData[questionIndex].type === "mcq" || quizData[questionIndex].type === "tf")
        ? ans === quizData[questionIndex].answer
        : ans.trim().toLowerCase() === quizData[questionIndex].answer.trim().toLowerCase()
    )
  ) score++;
  questionIndex++;
  if (questionIndex % questionsPerRound === 0 && questionIndex < quizData.length) {
    roundIndex++;
  }
  if (questionIndex < quizData.length) {
    showQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  document.getElementById('quizSection').style.display = 'none';
  document.getElementById('quizResult').style.display = 'block';
  document.getElementById('scoreBox').innerText = `Score: ${score} / ${quizData.length}`;
  // Reveal answers
  let html = "<ul>";
  for (let i = 0; i < quizData.length; i++) {
    html += `<li>
      <strong>Q${i+1}:</strong> ${quizData[i].question}<br>
      <strong>Your answer:</strong> ${userAnswers[i] || "<i>No answer</i>"}<br>
      <strong>Correct answer:</strong> ${quizData[i].answer}
    </li>`;
  }
  html += "</ul>";
  document.getElementById('answerReveal').innerHTML = html;
  saveScore(score, quizData.length);
  showProgress();
}

// Save score to backend database
async function saveScore(score, total) {
  const data = {
    grade: window.grade,
    strand: window.strand,
    file: selectedFile.name,
    date: new Date().toLocaleString(),
    score,
    total
  };
  await fetch('/api/save-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// Show progress/history table
async function showProgress() {
  let html = `<table>
    <thead>
      <tr>
        <th>Grade</th>
        <th>Strand</th>
        <th>File</th>
        <th>Date</th>
        <th>Score</th>
      </tr>
    </thead>
    <tbody>
  `;
  const res = await fetch('/api/get-scores');
  const scores = await res.json();
  scores.forEach(entry => {
    html += `<tr>
      <td>${entry.grade}</td>
      <td>${entry.strand}</td>
      <td>${entry.file}</td>
      <td>${entry.date}</td>
      <td>${entry.score} / ${entry.total}</td>
    </tr>`;
  });
  html += "</tbody></table>";
  document.getElementById('progressTable').innerHTML = html;
}