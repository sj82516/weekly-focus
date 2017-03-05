// 全部articleForm的元素
var articleForm = document.getElementById('article-form');
var articleFormTitle = document.getElementById('article-form__title');
var articleFormIntro = document.getElementById('article-form__intro');
var articleFormAuthor = document.getElementById('article-form__author');
var articleFormLink = document.getElementById('article-form__link');
var articleFormArticleId = document.getElementById('article-form__articleid');
var articleFormCsrfToken = document.getElementById('article-form__csrf-token');
var articleFormSubmitBtn = document.getElementById('article-form__submit');
// articleform可以是新增或是修改
var articleFormType = 'create';

// 監聽文章的編輯或刪除按鈕，轉為陣列形式
var articleEditBtnList = Array.prototype.slice.call(document.getElementsByClassName('article-form__edit-btn'));
var articleDeleteBtnList = Array.prototype.slice.call(document.getElementsByClassName('article-form__delete-btn'));

var xhr = new XMLHttpRequest();

articleForm.addEventListener('submit', function (evt) {
    var formData = new FormData(articleForm);
    evt.preventDefault();

    if (articleFormType == 'create') {
        xhr.open("POST", "/admin/article", true);
    } else {
        xhr.open("PUT", "/admin/article", true);
    }

    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.onload = function (oEvent) {
        var response = JSON.parse(xhr.response);
        if (xhr.status == 200 && response.article) {
            appendMsg(true, 'Successful!');

            if (articleFormType == 'create') {
                appendArticle(response.article);
            } else {
                updateArticle(response.article);
            }
            resetArticleForm();
        } else {
            appendMsg(false, 'Error!');
            resetArticleForm();
        }
    };
    xhr.send(urlencodeFormData(formData));
}, false);

articleEditBtnList.map(articleEditBtn => {
    articleEditBtn.addEventListener('click', articleEditBtnEvent, false)
});

articleDeleteBtnList.map(articleDeleteBtn => {
    articleDeleteBtn.addEventListener('click', articleDeleteBtnEvent, false)
});

document.getElementById('article-form__reset').addEventListener('click', resetArticleForm, false)

// 手動加入訊息
function appendMsg(isSuccess, msg) {
    var str = `<div class='${isSuccess ? "success-msg" : "error-msg"}'>${msg}</div>`,
        div = document.getElementsByClassName('content-block__title')[2];
    div.insertAdjacentHTML('beforeend', str);
}

// 手動Article
function appendArticle(article) {
    var str = `<article class="article-item" id="${article._id}">
                                <h1 class="article-item__title"> ${article.title}</h1>
                                <h4 class="article-item__author"> ${article.author}</h4>
                                <h2 class="article-item__intro"> ${article.intro}</h2>
                                <a class="article-item__link"> ${article.link}</a>
                                <br>
                                <button value="${article._id}" class="article-form__edit-btn"> edit</button>
                                <button value="${article._id}" class="article-form__delete-btn"> delete</button>
                                <article>`,
        div = document.getElementsByClassName('article-list')[0];
    div.insertAdjacentHTML('beforeend', str);
    setTimeout(
        (function(id){
            return () => document.getElementById(id).querySelector('.article-form__edit-btn').addEventListener('click', articleEditBtnEvent, false)
        })(article._id), 10);
    setTimeout(
        (function(id){
            return () => document.getElementById(id).querySelector('.article-form__delete-btn').addEventListener('click', articleDeleteBtnEvent, false)
        })(article._id), 10);
}

function articleEditBtnEvent() {
    "use strict";
    articleFormSubmitBtn.innerText = 'Update';
    articleFormType = 'update';
    var articleNode = document.getElementById(this.value);
    articleFormArticleId.value = this.value;

    // 將articleForm欄位填入選取的article值
    for (var i = 0; i < articleNode.childNodes.length; i++) {
        if (articleNode.childNodes[i].className == "article-item__title") {
            articleFormTitle.value = articleNode.childNodes[i].innerHTML;
        } else if (articleNode.childNodes[i].className == "article-item__author") {
            articleFormAuthor.value = articleNode.childNodes[i].innerHTML;
        } else if (articleNode.childNodes[i].className == "article-item__intro") {
            articleFormIntro.value = articleNode.childNodes[i].innerHTML;
        } else if (articleNode.childNodes[i].className == "article-item__link") {
            articleFormLink.value = articleNode.childNodes[i].innerHTML;
        }
    }
}

function articleDeleteBtnEvent() {
    var articleId = this.value;
    isConfirm = confirm("are you sure to delete?");
    if (isConfirm) {
        xhr.open("DELETE", "/admin/article", true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.onload = function (oEvent) {
            var response = JSON.parse(xhr.response);
            if (xhr.status == 200 && response.success) {
                appendMsg(true, 'Delete Successful!');
                deleteArtice(articleId);
            } else {
                appendMsg(false, 'Error!');
            }
            resetArticleForm();
        };
        xhr.send('articleId=' + articleId);
    }
}

// 修改article
function updateArticle(article) {
    var articleNode = document.getElementById(article._id);

    // 將articleForm欄位填入選取的article值
    for (var i = 0; i < articleNode.childNodes.length; i++) {
        if (articleNode.childNodes[i].className == "article-item__title") {
            articleNode.childNodes[i].innerHTML = article.title;
        } else if (articleNode.childNodes[i].className == "article-item__author") {
            articleNode.childNodes[i].innerHTML = article.author;
        } else if (articleNode.childNodes[i].className == "article-item__intro") {
            articleNode.childNodes[i].innerHTML = article.intro;
        } else if (articleNode.childNodes[i].className == "article-item__link") {
            articleNode.childNodes[i].innerHTML = article.link;
        }
    }
}

// 刪除article
function deleteArtice(articleId) {
    var elem = document.getElementById(articleId);
    elem.parentNode.removeChild(elem);
}

// formdata 強迫使用multipart/form-data，必須重新encode
function urlencodeFormData(fd) {
    var s = '';

    function encode(s) {
        return encodeURIComponent(s).replace(/%20/g, '+');
    }

    for (var pair of fd.entries()) {
        if (typeof pair[1] == 'string') {
            s += (s ? '&' : '') + encode(pair[0]) + '=' + encode(pair[1]);
        }
    }
    return s;
}

function resetArticleForm() {
    articleForm.reset();
    articleFormType = 'create';
    articleFormSubmitBtn.innerText = 'Create';
}
