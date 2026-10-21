// ==============================
// 1. 데이터: 앱이 기억하는 정보
// ==============================

// 참석자 이름 목록 (예: ["김팀장", "이대리"])
let people = [];


// ==============================
// 2. 화면 요소 찾기 (index.html의 id로 찾음)
// ==============================

const nameInput = document.getElementById("name-input");
const addPersonBtn = document.getElementById("add-person-btn");
const peopleList = document.getElementById("people-list");


// ==============================
// 3. 동작: 데이터를 바꾸는 함수들
// ==============================

// 입력칸의 이름을 참석자 목록에 추가
function addPerson() {
  const name = nameInput.value.trim(); // 앞뒤 공백 제거

  if (name === "") {
    return; // 빈 이름은 무시
  }
  if (people.includes(name)) {
    alert(`'${name}'은(는) 이미 있는 이름이에요.`);
    return;
  }

  people.push(name);
  nameInput.value = ""; // 입력칸 비우기
  nameInput.focus();    // 바로 다음 이름을 입력할 수 있게
  renderPeople();
}

// 참석자 목록에서 이름 삭제
function removePerson(name) {
  people = people.filter((p) => p !== name);
  renderPeople();
}


// ==============================
// 4. 화면 그리기: 데이터를 화면에 반영
// ==============================

// people 목록을 보고 참석자 목록 화면을 새로 그림
function renderPeople() {
  peopleList.innerHTML = ""; // 기존 목록 지우기

  for (const name of people) {
    const li = document.createElement("li");
    li.textContent = name + " ";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removePerson(name));

    li.appendChild(removeBtn);
    peopleList.appendChild(li);
  }
}


// ==============================
// 5. 이벤트 연결: 사용자가 무언가 하면 함수 실행
// ==============================

// '추가' 버튼을 누르면 추가
addPersonBtn.addEventListener("click", addPerson);

// 입력칸에서 엔터를 눌러도 추가
nameInput.addEventListener("keydown", (event) => {
  // 한글 입력 중(조합 중) 엔터는 무시해야 마지막 글자가 중복 입력되지 않음
  if (event.key === "Enter" && !event.isComposing) {
    addPerson();
  }
});
