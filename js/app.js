// ============================
// 主应用逻辑
// ============================

(function() {
    'use strict';

    // 状态管理
    const state = {
        currentQuestion: 0,
        answers: {},  // { questionId: optionIndex }
        scores: { military: 0, political: 0, economic: 0, social: 0, diplomatic: 0 }
    };

    // DOM 元素
    const pages = {
        intro: document.getElementById('page-intro'),
        quiz: document.getElementById('page-quiz'),
        result: document.getElementById('page-result')
    };

    const els = {
        btnStart: document.getElementById('btn-start'),
        btnPrev: document.getElementById('btn-prev'),
        btnNext: document.getElementById('btn-next'),
        btnRestart: document.getElementById('btn-restart'),
        btnShare: document.getElementById('btn-share'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        questionContext: document.getElementById('question-context'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        factionResult: document.getElementById('faction-result'),
        axesResult: document.getElementById('axes-result'),
        detailAnalysis: document.getElementById('detail-analysis')
    };

    // 页面切换
    function showPage(pageName) {
        Object.values(pages).forEach(p => p.classList.remove('active'));
        pages[pageName].classList.add('active');
        window.scrollTo(0, 0);
    }

    // 渲染题目
    function renderQuestion() {
        const q = QUESTIONS[state.currentQuestion];
        const total = QUESTIONS.length;

        // 进度条
        const pct = ((state.currentQuestion + 1) / total) * 100;
        els.progressFill.style.width = pct + '%';
        els.progressText.textContent = (state.currentQuestion + 1) + ' / ' + total;

        // 题目内容
        els.questionContext.textContent = q.context;
        els.questionText.textContent = q.question;

        // 选项
        els.optionsContainer.innerHTML = '';
        const labels = ['A', 'B', 'C', 'D'];
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            if (state.answers[q.id] === idx) {
                btn.classList.add('selected');
            }
            btn.innerHTML = '<span class="option-label">' + labels[idx] + '</span>' + opt.text;
            btn.addEventListener('click', function() {
                selectOption(q.id, idx);
            });
            els.optionsContainer.appendChild(btn);
        });

        // 导航按钮
        els.btnPrev.disabled = state.currentQuestion === 0;
        updateNextButton();

        // 动画
        const area = document.querySelector('.question-area');
        area.style.animation = 'none';
        area.offsetHeight; // 触发 reflow
        area.style.animation = 'fadeIn 0.4s ease';
    }

    // 选择选项
    function selectOption(questionId, optionIndex) {
        state.answers[questionId] = optionIndex;

        // 更新选中状态
        const btns = els.optionsContainer.querySelectorAll('.option-btn');
        btns.forEach((btn, idx) => {
            btn.classList.toggle('selected', idx === optionIndex);
        });

        updateNextButton();

        // 自动跳转下一题（延迟）
        if (state.currentQuestion < QUESTIONS.length - 1) {
            setTimeout(function() {
                state.currentQuestion++;
                renderQuestion();
            }, 400);
        } else {
            // 最后一题，更新按钮
            updateNextButton();
        }
    }

    // 更新下一题按钮
    function updateNextButton() {
        const q = QUESTIONS[state.currentQuestion];
        const answered = state.answers[q.id] !== undefined;

        if (state.currentQuestion === QUESTIONS.length - 1) {
            els.btnNext.textContent = '查看结果';
            els.btnNext.disabled = !answered;
        } else {
            els.btnNext.textContent = '下一题';
            els.btnNext.disabled = !answered;
        }
    }

    // 计算分数
    function calculateScores() {
        const scores = { military: 0, political: 0, economic: 0, social: 0, diplomatic: 0 };
        let answeredCount = 0;

        QUESTIONS.forEach(function(q) {
            if (state.answers[q.id] !== undefined) {
                const opt = q.options[state.answers[q.id]];
                Object.keys(scores).forEach(function(dim) {
                    scores[dim] += opt.scores[dim];
                });
                answeredCount++;
            }
        });

        // 归一化到 -100 ~ +100
        // 每题每维度最大 ±3，100题最大 ±300
        const maxPossible = QUESTIONS.length * 3;
        Object.keys(scores).forEach(function(dim) {
            scores[dim] = Math.round((scores[dim] / maxPossible) * 100);
            scores[dim] = Math.max(-100, Math.min(100, scores[dim]));
        });

        state.scores = scores;
        return scores;
    }

    // 匹配派系
    function matchFaction(scores) {
        let bestFaction = FACTIONS[0];
        let bestDistance = Infinity;

        FACTIONS.forEach(function(faction) {
            let distance = 0;
            Object.keys(scores).forEach(function(dim) {
                const diff = scores[dim] - faction.center[dim];
                distance += diff * diff;
            });
            distance = Math.sqrt(distance);

            if (distance < bestDistance) {
                bestDistance = distance;
                bestFaction = faction;
            }
        });

        // 计算匹配度 (0-100%)
        const maxDistance = Math.sqrt(5 * 200 * 200); // 5维度，每个最大差200
        const matchPercent = Math.round((1 - bestDistance / maxDistance) * 100);

        return {
            faction: bestFaction,
            matchPercent: Math.max(matchPercent, 30            ),
            distance: bestDistance
        };
    }

    // 获取第二匹配派系
    function getSecondFaction(scores, firstFactionId) {
        let bestFaction = null;
        let bestDistance = Infinity;

        FACTIONS.forEach(function(faction) {
            if (faction.id === firstFactionId) return;
            let distance = 0;
            Object.keys(scores).forEach(function(dim) {
                const diff = scores[dim] - faction.center[dim];
                distance += diff * diff;
            });
            distance = Math.sqrt(distance);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestFaction = faction;
            }
        });

        const maxDistance = Math.sqrt(5 * 200 * 200);
        const matchPercent = Math.round((1 - bestDistance / maxDistance) * 100);

        return {
            faction: bestFaction,
            matchPercent: Math.max(matchPercent, 20)
        };
    }

    // 获取维度描述
    function getDimensionLabel(dim, score) {
        const labels = {
            military: {
                name: '抗战路线',
                left: '全民动员 / 人民战争',
                right: '正规军主导 / 阵地战',
                negDesc: '你倾向于全民动员式的人民战争路线，认为应当武装群众、深入敌后、以游击战为主要作战方式。',
                posDesc: '你倾向于以正规军为主体的正面作战路线，重视大兵团作战、阵地防御和现代化军事力量。',
                neutDesc: '你认为正面战场和敌后战场都很重要，应当相互配合、各尽所能。'
            },
            political: {
                name: '政治体制',
                left: '民主协商 / 多党合作',
                right: '威权集中 / 一党主导',
                negDesc: '你坚定支持民主政治——多党协商、权力制衡、保障公民自由。你反对任何形式的一党专制。',
                posDesc: '你认为国家需要强有力的中央权威和集中统一的领导，特别是在危机时期。效率和秩序优先于程序和自由。',
                neutDesc: '你在政治体制问题上持较为中间的立场，认为民主与权威需要根据具体情况进行平衡。'
            },
            economic: {
                name: '经济政策',
                left: '社会改革 / 平等分配',
                right: '维护现状 / 市场自由',
                negDesc: '你主张通过深刻的社会经济改革来改变不平等的现状——土地改革、缩小贫富差距、保障劳动者权益。',
                posDesc: '你倾向于维护现有的经济秩序和财产权利，重视市场机制和私人企业的作用，反对激进的经济变革。',
                neutDesc: '你在经济政策上持温和立场，认为适度的改革是必要的，但不应过于激进。'
            },
            social: {
                name: '社会文化',
                left: '群众运动 / 社会改造',
                right: '精英秩序 / 传统维护',
                negDesc: '你相信群众运动和社会改造的力量，主张彻底打破旧的社会等级和文化传统，建设一个全新的社会。',
                posDesc: '你重视社会秩序和传统价值，相信精英阶层的引领作用。你倾向于渐进改良而非激进革命。',
                neutDesc: '你在社会文化问题上持较为平衡的态度，既认可社会改革的必要性，也尊重传统和秩序的价值。'
            },
            diplomatic: {
                name: '外交立场',
                left: '独立自主 / 反帝',
                right: '国际合作 / 亲西方',
                negDesc: '你坚持独立自主的外交路线，对帝国主义列强保持高度警惕，认为中国的命运必须掌握在自己手中。',
                posDesc: '你重视国际合作和外部援助，积极争取与西方国家的合作关系，认为中国的发展离不开融入国际社会。',
                neutDesc: '你在外交上持务实立场，既重视独立自主，也不排斥国际合作。'
            }
        };

        const info = labels[dim];
        let desc;
        if (score < -20) {
            desc = info.negDesc;
        } else if (score > 20) {
            desc = info.posDesc;
        } else {
            desc = info.neutDesc;
        }

        return { ...info, desc: desc };
    }

    // 渲染结果页面
    function renderResult() {
        const scores = calculateScores();
        const result = matchFaction(scores);
        const secondResult = getSecondFaction(scores, result.faction.id);

        // ====== 派系结果 ======
        let factionHTML = '';
        factionHTML += '<div class="faction-match">' + result.faction.emoji + '</div>';
        factionHTML += '<div class="faction-name" style="color:' + result.faction.color + '">' + result.faction.name + '</div>';
        factionHTML += '<div class="faction-figures">代表人物：' + result.faction.figures + '</div>';
        factionHTML += '<div style="margin:15px 0;color:var(--color-accent2);">匹配度：' + result.matchPercent + '%</div>';
        factionHTML += '<div class="faction-desc">' + result.faction.description + '</div>';

        // 次要匹配
        if (secondResult.faction) {
            factionHTML += '<div style="margin-top:30px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);">';
            factionHTML += '<p style="color:var(--color-text-dim);margin-bottom:10px;">次要匹配派系：</p>';
            factionHTML += '<div style="font-size:1.2em;">' + secondResult.faction.emoji + ' ';
            factionHTML += '<span style="color:' + secondResult.faction.color + '">' + secondResult.faction.name + '</span>';
            factionHTML += ' <span style="color:var(--color-text-dim);font-size:0.8em;">(' + secondResult.matchPercent + '%)</span></div>';
            factionHTML += '<p style="color:var(--color-text-dim);font-size:0.9em;margin-top:8px;">代表人物：' + secondResult.faction.figures + '</p>';
            factionHTML += '</div>';
        }

        els.factionResult.innerHTML = factionHTML;

        // ====== 维度结果 ======
        let axesHTML = '<h2>五维度分析</h2>';
        const dims = ['military', 'political', 'economic', 'social', 'diplomatic'];

        dims.forEach(function(dim) {
            const info = getDimensionLabel(dim, scores[dim]);
            const position = ((scores[dim] + 100) / 200) * 100; // 转为0-100%

            axesHTML += '<div class="result-axis">';
            axesHTML += '<div class="result-axis-header">';
            axesHTML += '<span class="result-axis-label-left">' + info.left + '</span>';
            axesHTML += '<span class="result-axis-label-right">' + info.right + '</span>';
            axesHTML += '</div>';
            axesHTML += '<div class="result-axis-bar">';
            axesHTML += '<div class="result-axis-marker" style="left:' + position + '%"></div>';
            axesHTML += '</div>';
            axesHTML += '<div class="result-axis-name">' + info.name + '</div>';
            axesHTML += '<div class="result-axis-score">' + scores[dim] + '</div>';
            axesHTML += '</div>';
        });

        els.axesResult.innerHTML = axesHTML;

        // ====== 详细分析 ======
        let detailHTML = '<h2>详细分析报告</h2>';

        // 各维度详细分析（使用匹配派系的分析文本）
        const dimNames = {
            military: '🎯 抗战路线',
            political: '🏛️ 政治体制',
            economic: '💰 经济政策',
            social: '👥 社会文化',
            diplomatic: '🌐 外交立场'
        };

        dims.forEach(function(dim) {
            const info = getDimensionLabel(dim, scores[dim]);
            detailHTML += '<div class="detail-section">';
            detailHTML += '<h3>' + dimNames[dim] + '（得分：' + scores[dim] + '）</h3>';
            detailHTML += '<p>' + info.desc + '</p>';
            if (result.faction.analysis && result.faction.analysis[dim]) {
                detailHTML += '<p style="margin-top:10px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid ' + result.faction.color + ';">';
                detailHTML += '<strong>从' + result.faction.name + '的视角来看：</strong><br>' + result.faction.analysis[dim];
                detailHTML += '</p>';
            }
            detailHTML += '</div>';
        });

        // 历史背景
        detailHTML += '<div class="detail-section">';
        detailHTML += '<h3>📜 历史背景</h3>';
        detailHTML += '<p>' + result.faction.historicalContext + '</p>';
        detailHTML += '</div>';

        // 所有派系对比
        detailHTML += '<div class="detail-section">';
        detailHTML += '<h3>📊 所有派系匹配度</h3>';
        detailHTML += '<div style="margin-top:15px;">';

        // 计算所有派系的距离并排序
        const allMatches = FACTIONS.map(function(faction) {
            let distance = 0;
            Object.keys(scores).forEach(function(dim) {
                const diff = scores[dim] - faction.center[dim];
                distance += diff * diff;
            });
            distance = Math.sqrt(distance);
            const maxDist = Math.sqrt(5 * 200 * 200);
            const pct = Math.max(Math.round((1 - distance / maxDist) * 100), 10);
            return { faction: faction, matchPercent: pct, distance: distance };
        });

        allMatches.sort(function(a, b) { return a.distance - b.distance; });

        allMatches.forEach(function(m) {
            const barWidth = m.matchPercent;
            detailHTML += '<div style="margin-bottom:12px;">';
            detailHTML += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
            detailHTML += '<span style="font-size:0.9em;">' + m.faction.emoji + ' ' + m.faction.name + '</span>';
            detailHTML += '<span style="font-size:0.85em;color:var(--color-accent2);">' + m.matchPercent + '%</span>';
            detailHTML += '</div>';
            detailHTML += '<div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">';
            detailHTML += '<div style="height:100%;width:' + barWidth + '%;background:' + m.faction.color + ';border-radius:4px;transition:width 1s ease;"></div>';
            detailHTML += '</div>';
            detailHTML += '</div>';
        });

        detailHTML += '</div></div>';

        // 原始分数
        detailHTML += '<div class="detail-section">';
        detailHTML += '<h3>📈 原始维度得分</h3>';
        detailHTML += '<table style="width:100%;border-collapse:collapse;margin-top:10px;">';
        detailHTML += '<tr style="border-bottom:1px solid rgba(255,255,255,0.1);">';
        detailHTML += '<th style="text-align:left;padding:8px;color:var(--color-text-dim);">维度</th>';
        detailHTML += '<th style="text-align:center;padding:8px;color:var(--color-text-dim);">得分</th>';
        detailHTML += '<th style="text-align:left;padding:8px;color:var(--color-text-dim);">倾向</th>';
        detailHTML += '</tr>';

        dims.forEach(function(dim) {
            const info = getDimensionLabel(dim, scores[dim]);
            let tendency;
            if (scores[dim] < -40) tendency = '强烈偏左';
            else if (scores[dim] < -20) tendency = '偏左';
            else if (scores[dim] < -5) tendency = '轻微偏左';
            else if (scores[dim] <= 5) tendency = '中间';
            else if (scores[dim] <= 20) tendency = '轻微偏右';
            else if (scores[dim] <= 40) tendency = '偏右';
            else tendency = '强烈偏右';

            detailHTML += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">';
            detailHTML += '<td style="padding:8px;">' + info.name + '</td>';
            detailHTML += '<td style="text-align:center;padding:8px;color:var(--color-accent2);">' + scores[dim] + '</td>';
            detailHTML += '<td style="padding:8px;color:var(--color-text-dim);">' + tendency + '</td>';
            detailHTML += '</tr>';
        });

        detailHTML += '</table></div>';

        // 免责声明
        detailHTML += '<div class="detail-section">';
        detailHTML += '<div style="background:rgba(233,69,96,0.1);border:1px solid rgba(233,69,96,0.3);border-radius:8px;padding:15px;margin-top:10px;">';
        detailHTML += '<p style="color:var(--color-accent);font-size:0.9em;margin:0;">';
        detailHTML += '⚠️ <strong>免责声明：</strong>本测试仅供历史学习与趣味参考。题目基于抗战时期的真实历史事件和争议设计，';
        detailHTML += '旨在帮助了解那个时代不同政治力量的立场和逻辑。测试结果不代表对任何历史人物或政治派别的赞同或批判，';
        detailHTML += '也不反映测试者的现实政治立场。历史是复杂的，任何标签化的归类都是简化的。';
        detailHTML += '</p></div></div>';

        els.detailAnalysis.innerHTML = detailHTML;

        // 添加动画效果
        els.factionResult.classList.add('fade-in');
        els.axesResult.classList.add('fade-in');
        els.detailAnalysis.classList.add('fade-in');
    }

    // 分享功能
    function shareResult() {
        const result = matchFaction(state.scores);
        const text = '我在【抗战时期政治光谱测试】中的结果是：' + result.faction.emoji + ' ' +
                     result.faction.name + '（匹配度' + result.matchPercent + '%）\n' +
                     '五维度得分：抗战路线' + state.scores.military +
                     ' | 政治体制' + state.scores.political +
                     ' | 经济政策' + state.scores.economic +
                     ' | 社会文化' + state.scores.social +
                     ' | 外交立场' + state.scores.diplomatic;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                alert('结果已复制到剪贴板，可以粘贴分享给朋友！');
            }).catch(function() {
                fallbackShare(text);
            });
        } else {
            fallbackShare(text);
        }
    }

    function fallbackShare(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('结果已复制到剪贴板！');
        } catch (e) {
            alert('请手动复制以下文字分享：\n\n' + text);
        }
        document.body.removeChild(textarea);
    }

    // 重新开始
    function restart() {
        state.currentQuestion = 0;
        state.answers = {};
        state.scores = { military: 0, political: 0, economic: 0, social: 0, diplomatic: 0 };
        showPage('intro');
    }

    // 事件绑定
    els.btnStart.addEventListener('click', function() {
        showPage('quiz');
        renderQuestion();
    });

    els.btnPrev.addEventListener('click', function() {
        if (state.currentQuestion > 0) {
            state.currentQuestion--;
            renderQuestion();
        }
    });

    els.btnNext.addEventListener('click', function() {
        if (state.currentQuestion < QUESTIONS.length - 1) {
            state.currentQuestion++;
            renderQuestion();
        } else {
            // 检查是否全部回答
            let allAnswered = true;
            QUESTIONS.forEach(function(q) {
                if (state.answers[q.id] === undefined) {
                    allAnswered = false;
                }
            });

            if (!allAnswered) {
                const unanswered = QUESTIONS.filter(function(q) {
                    return state.answers[q.id] === undefined;
                });
                const confirm_result = confirm(
                    '您还有 ' + unanswered.length + ' 道题未回答。\n' +
                    '未回答的题目将不计入评分。\n\n' +
                    '是否继续查看结果？'
                );
                if (!confirm_result) return;
            }

            showPage('result');
            renderResult();
        }
    });

    els.btnRestart.addEventListener('click', restart);
    els.btnShare.addEventListener('click', shareResult);

    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
        if (!pages.quiz.classList.contains('active')) return;

        if (e.key === 'ArrowLeft' && !els.btnPrev.disabled) {
            els.btnPrev.click();
        } else if (e.key === 'ArrowRight' && !els.btnNext.disabled) {
            els.btnNext.click();
        } else if (['1','2','3','4'].indexOf(e.key) !== -1) {
            const idx = parseInt(e.key) - 1;
            const btns = els.optionsContainer.querySelectorAll('.option-btn');
            if (btns[idx]) btns[idx].click();
        }
    });

})();
