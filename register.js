var bartimer;
// var register_timeout_time = 600; //register overtime, seconds, 10min
var register_timeout_time = 180; //register overtime, seconds, 10min
var register_starttime;
var isCu=false;
var isCM =false;
var data_regmode;
var sessionidstr = "";
var wan_session_index = 0;
var data_areacode,progress_value;
var g_operators_code_ex = "";
$(document).ready(function(){
	$("#loid").val('');
	$("#password").val('');
	
	$(".return_tologin").bind("click", function(){
		window.location.href = "../index.html";
	});

	XHR.get("get_register_result", null, isagainregister);
	$("#reg_button").bind("click", function(){
		if ( validCheck() )
		{
			//check ok, do register
			var postdata = new Object();
			var b = new Base64();
			if( data_regmode == "1"){
				postdata.action = "id";
				postdata.loid = $("#loid").val();
			}else{
				postdata.action = "pass";
			}
			//postdata.loid = $("#loid").val();
			postdata.password = b.encode($("#password").val());
			
			/* 把输入得密码转为对应ascii码值的16进制 */
			var pwdascii=new Array();
			for (var i = 0; i < $("#password").val().length; i++ )
			{
				pwdascii.push($("#password").val().charCodeAt(i).toString(16));
			}
			
			postdata.GPONPassWordAsciiHex = pwdascii.join("");
			postdata.sessionid = sessionidstr;
			XHR.post("do_loidregister", postdata, null);
			
			register_starttime = new Date().getTime(); //millisecond
			
			showRegisterResult();
		}
	});
});

function showRegisterResult()
{
	//show progress bar
	$("#register_div").hide();
	$("#progress_div").show();
	
	//初始几秒钟使用假数据模拟注册到OLT的状态，以便后台进行处理。
	showFakeResultAtBegin();

	// 四川省已经注册OLT（20%）后再注册会弹出提示
	if (data_areacode == "Sichuan" && progress_value > 20)
	{
		alert("设备已注册，建议恢复出厂后重新注册。");
	}
	
	setTimeout(function(){
		//check register result every 2 seconds
		checkRegisterResult();
		bartimer = window.setInterval(function(){checkRegisterResult();},2000);
		},5000
	);
}

function showFakeResultAtBegin()
{
	var fakedata = {
		"progress_stop":0,
		"progress_value":20,
		"is_error":0,
		"error_type":-1,
		"stage":0,
		"services":"",
		"data_type":-1
	}
	
	parseRegisterData(fakedata);
}

function validCheck()
{
	if ( $("#loid").val() == '' &&  data_regmode == "1")
	{
		alert("LOID不能为空");
		return false;
	}
	if ( isCnInclude($("#loid").val()) && data_regmode == "1")
	{
		alert("LOID不能包含中文");
		return false;
	}
	if ( isCnInclude($("#password").val()) )
	{
		alert("password不能包含中文");
		return false;
	}
	
	$("#loid_hint").html("");
	$("#password_hint").html("如无密码请留空");
	return true;
}

function validCheckCu()
{
	if ( $("#loid").val() == '' )
	{
		alert("逻辑ID不能为空");
		return false;
	}
	if ( isCnInclude($("#loid").val()) )
	{
		alert("逻辑ID不能包含中文");
		return false;
	}
	if ( $("#password").val() != '' && isCnInclude($("#password").val()) )
	{
		alert("密码不能包含中文");
		return false;
	}
	return true;
}

function validCheckCM()
{
	if ( $("#password").val() != '' && isCnInclude($("#password").val()) )
	{
		alert("密码不能包含中文");
		return false;
	}
	if ($("#password").val().length > 10)
	{
		alert("输入密码的长度不能大于10！请重新输入");
		$("#password").val("");
		return false;
	}
	return true;
}

var gDoCheckRegisterResult = true;
function checkRegisterResult()
{
	if ( ! gDoCheckRegisterResult )
	{
		return;
	}
	if ( gDebug ) //调试模式读取本地数据
	{
		getDataByAjax("../fake/register_result", parseRegisterData);
	}
	else
	{
		XHR.get("get_register_result", null, parseRegisterData);
	}
}

function parseRegisterData(data)
{
	if ( data )
	{
		setProcess( data );
	};

	if ( data.sessionid != undefined )
	{
		sessionidstr = data.sessionid;
	};
}

function setProcess( data )
{
	var processbar = document.getElementById("progress_bar");
	var current_process_width = parseInt(processbar.style.width);
	var next_process_width = data.progress_value;
	//if register timeout
	var timenow = new Date().getTime();
	if ( parseInt(timenow - register_starttime)/1000 > register_timeout_time )
	{
		if ( current_process_width <= 20 )//still register to olt
		{
			if (isCM == true)
			{
				$("#progress_hint").html("在OLT上注册失败,请检查光信号灯是否处于熄灭状态、Password是否正确");
			}
			else if (isCu == true)
			{
				$("#progress_hint").html("在OLT上注册失败,请检查光信号灯是否处于熄灭状态、Password是否正确");
			}
			else
			{
				$("#progress_hint").html("在OLT上注册失败,请检查光信号灯是否处于熄灭状态、Password是否正确");
			}
		}
		else if ( current_process_width <= 30 )// getting ip
		{
			if (isCM == true)
			{
				$("#progress_hint").html("到省级数字家庭管理平台的通道不通,请联系客户经理或拨打10086");
			}
			else if (isCu == true)
			{
				$("#progress_hint").html("到省级数字家庭管理平台的通道不通,请联系客户经理或拨打10010");
			}
			else
			{
				$("#progress_hint").html("到省级数字家庭管理平台的通道不通,请联系客户经理或拨打10000");
			}
		}
		else if ( current_process_width <= 40 )// connecting to RMS
		{
			if (isCM == true)
			{
				$("#progress_hint").html("到省级数字家庭管理平台的通道不通,请联系客户经理或拨打10086");
			}
			else if (isCu == true)
			{
				$("#progress_hint").html("到省级数字家庭管理平台的通道不通,请联系客户经理或拨打10010");
			}
			else
			{
				$("#progress_hint").html("到省级数字家庭管理平台的通道不通,请联系客户经理或拨打10000");
			}
		}
		else if ( current_process_width >= 50 || current_process_width <= 99 )// getting data form RMS
		{
			if (isCM == true)
			{
				$("#progress_hint").html("省级数字家庭管理平台下发业务异常,请联系客户经理或拨打10086");
			}
			else if (isCu == true)
			{
				$("#progress_hint").html("省级数字家庭管理平台下发业务异常,请联系客户经理或拨打10010");
			}
			else
			{
				$("#progress_hint").html("省级数字家庭管理平台下发业务异常,请联系客户经理或拨打10000");
			}
		}
		else
		{
			$("#progress_hint").html("注册超时！");
		}
		$("#progress_hint").addClass("progress_hint_red");
		window.clearInterval(bartimer);
		$("#progress_div .return_tologin").show();
		return;
	}
	//if error, show result, hide progress bar
	if ( data.is_error == 1 )
	{
		// typedef enum
		// {
			// ERROR_OLT_REG_FAIL = 0,
			// ERROR_CANNOT_ACCESS_RMS = 1,
			// ERROR_RMS_REG_FIAL = 2,
			// ERROR_RMS_REG_LIMIT = 3,
			// ERROR_RMS_REG_TIMEOUT = 4,
			// ERROR_RMS_ALREADY_REGED = 5,
			// ERROR_RMS_SERVICE_UNUSUAL = 6,
			// ERROR_UNKNOWN = 7,
		// }ERROR_TYPE;
		if ( data.error_type == 7 )
		{
			$("#progress_hint").html("未知错误");
		}
		else if ( data.error_type == 2 )
		{
			if (isCM == true)
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册失败，请联系客户经理或拨打10086");
			}
			else if (isCu == true)
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册失败，请联系客户经理或拨打10010");
			}
			else
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册失败，请联系客户经理或拨打10000");
			}
		}
		else if ( data.error_type == 3 )
		{
			if (isCM == true)
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册失败,正在重试");
			}
			else if (isCu == true)
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册失败,正在重试");
			}
			else
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册失败,正在重试");
			}
		}
		else if ( data.error_type == 4 )
		{
			if (isCM == true)
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册超时！请检查线路后重试，如无法解决请联系客户经理或拨打10086");
			}
			else if (isCu == true)
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册超时！请检查线路后重试，如无法解决请联系客户经理或拨打10010");
			}
			else
			{
				$("#progress_hint").html("在省级数字家庭管理平台上注册超时！请检查线路后重试，如无法解决请联系客户经理或拨打10000");
			}
		}
		else if ( data.error_type == 5 )
		{
			$("#progress_hint").html("已经在省级数字家庭管理平台注册成功，无需再注册");
		}
		else if ( data.error_type == 6 )
		{
			if (isCM == true)
			{
				$("#progress_hint").html("省级数字家庭管理平台下发业务异常，请联系客户经理或拨打10086");
			}
			else if (isCu == true)
			{
				$("#progress_hint").html("省级数字家庭管理平台下发业务异常，请联系客户经理或拨打10010");
			}
			else
			{
				$("#progress_hint").html("省级数字家庭管理平台下发业务异常，请联系客户经理或拨打10000");
			}
		}
		
		$("#progress_hint").addClass("progress_hint_red");
		$(".progress_container").hide();
	}
	
	if ( next_process_width >= current_process_width )
	{
		doProcessIncreas(current_process_width, next_process_width, data);
	}
	
	
	if( parseInt(processbar.style.width) >= 100 || data.progress_stop == 1 || data.is_error == 1 )
	{
		window.clearInterval(bartimer);
		$("#progress_div .return_tologin").show();
	}
}

function doProcessIncreas(current_process_width, next_process_width, data)
{
	var dvalue = parseInt(next_process_width - current_process_width);
	var processbar = document.getElementById("progress_bar");
	
	if ( dvalue > 0 )
	{
		gDoCheckRegisterResult = false;
		current_process_width = current_process_width + 1;
		if ( parseInt(document.getElementById("progress_bar").style.width) < current_process_width )
		{
			processbar.style.width = current_process_width + "%";
			processbar.innerHTML = processbar.style.width;
		}
		setTimeout(function(){doProcessIncreas(current_process_width, next_process_width, data);},200);
	}
	else //when progress bar when to next_process_width, refresh progress_hint
	{
		gDoCheckRegisterResult = true;
		if ( data.is_error == 0 )
		{
			// typedef enum
			// {
				// STAGE_REGGING_OLT = 0,
				// STAGE_GETTING_IP = 1,
				// STAGE_CONNECTING_RMS = 2,
				// STAGE_WATTING_RMS_DATA = 3,
				// STAGE_RMS_SENDING_DATA = 4,
				// STAGE_RMS_DATA_SUCCESS_NEEDREBOOT = 5,
				// STAGE_RMS_DATA_SUCCESS_NONEEDREBOOT = 6,
			// }STAGE_TYPE;
			if ( data.stage == 0 )
			{
				$("#progress_hint").html("正在注册OLT");
			}
			else if ( data.stage == 1 )
			{
				$("#progress_hint").html("正在获取管理IP");
			}
			else if ( data.stage == 2 )
			{
				$("#progress_hint").html("已获得管理IP，正在连接省级数字家庭管理平台");
			}
			else if ( data.stage == 3 )
			{
				$("#progress_hint").html("等待省级数字家庭管理平台下发业务数据");
			}
			else if ( data.stage == 4 )
			{
				// typedef enum
				// {
					// RMS_DATA_INTERNET = 0,
					// RMS_DATA_IPTV,
					// RMS_DATA_VOICE,
					// RMS_DATA_OTHER,
				// }RMS_DATA_TYPE;
				if ( data.data_type > -1 )
				{
					var data_str = '';
					if ( data.data_type == 0 )
					{
						data_str = '上网';
					}
					else if ( data.data_type == 1 )
					{
						data_str = 'iTV';
					}
					else if ( data.data_type == 2 )
					{
						data_str = '语音';
					}
					else if ( data.data_type == 3 )
					{
						data_str = '其它';
					}
					$("#progress_hint").html("省级数字家庭管理平台正在下发" + data_str + "业务数据，请勿断电或拨光纤");
				}
				else
				{
					$("#progress_hint").html("省级数字家庭管理平台正在下发业务数据,请勿断电或拨光纤");
				}
			}
			else if ( data.stage == 5 || data.stage == 6 )
			{
				var servicelist = '';
				var servicenum = 0;
				var reboothint = '';
				if ( data.stage == 5 )
				{
					reboothint = "，网关需要重启，请等待";
				}
				if ( data.services != '' )
				{
					if ( data.services.toUpperCase().indexOf("INTERNET") >= 0 )
					{
						servicenum = servicenum + 1;
						if (servicelist == "")
						{
							servicelist = "宽带";
						}
						else
						{
							servicelist = servicelist + "、宽带";
						}
					}
					if ( data.services.toUpperCase().indexOf("VOIP") >= 0 )
					{
						servicenum = servicenum + 1;
						if (servicelist == "")
						{
							servicelist = "语音";
						}
						else
						{
							servicelist = servicelist + "、语音";
						}
					}
					if ( data.services.toUpperCase().indexOf("IPTV") >= 0 )
					{
						if(data_areacode == "Chongqing")
						{
							var iptvnum = 0;
							var iptvstr = "";
							var servicelistArr = data.services.toUpperCase().split(",");
							for(var i = 0; i < servicelistArr.length; i++)
							{
								if(servicelistArr[i] == "IPTV")
								{
									iptvnum++;
									if(iptvnum == 1)
									{
										iptvstr = "iTV"
									}
									else
									{
										iptvstr = iptvstr + "、iTV" + iptvnum;
									}
								}
							}
							if (servicelist == "")
							{
								servicelist = iptvstr;
							}
							else
							{
								servicelist = servicelist + "、" + iptvstr;
							}
						}
						else
						{
							servicenum = servicenum + 1;
							if (servicelist == "")
							{
								servicelist = "iTV";
							}
							else
							{
								servicelist = servicelist + "、iTV";
							}
						}
					}
					if ( data.services.toUpperCase().indexOf("OTHER") >= 0 )
					{
						servicenum = servicenum + 1;
						if (servicelist == "")
						{
							servicelist = "其它";
						}
						else
						{
							servicelist = servicelist + "、其它";
						}
					}
				}
				if(data_areacode == "Chongqing")
				{
					servicenum = data.ServiceNum;
				}
				if ( servicenum == 0 )
				{
					$("#progress_hint").html("省级数字家庭管理平台业务数据下发成功" + reboothint);
				}
				else
				{
					$("#progress_hint").html("省级数字家庭管理平台业务数据下发成功,共下发了" + servicelist + " " + servicenum + "个业务" + reboothint);
				}
				
			}
		}
	}
}
function isagainregister(data){
	g_operators_code_ex = data.operators_code_ex;
	if(g_operators_code_ex == "CATV")
	{
		document.title = "智能网关";
		$(".line_10086").hide();
	}
	else
	{
		document.title = "中国移动智能网关";
		$(".line_10086").show();
	}
	data_areacode = data.area;
	progress_value = data.progress_value;
	data_regmode = data.regmode;
	if( data_regmode == "0" ){
		$("#Loid_div").hide();
	}else{
		$("#Loid_div").show();
		$(".regmode").html("Loid");
	};

	if ( data.area == "Guangdong" )
	{
		$("#register_type").show();
		XHR.get("get_allwan_info", null, function(getData){
			var wanlist = getData.wan;
			if( wanlist != "" )
			{
				for (var i = 0; i < wanlist.length; i++) {
					if( wanlist[i].ServiceList == "TR069")
					{
						wan_session_index = wanlist[i].wan_session_index;
						if (wanlist[i].IPMode == "1") {
							$("#Manual_IPV4").css("background","#7CCD7C");
						}
						else if (wanlist[i].IPMode == "2")
						{
							$("#Manual_IPV6").css("background","#7CCD7C");
						};
						break;
					}
				}
			}
		});
	}
}

function Manualsetting(element){
	
	 if (wan_session_index == 0)
	 {
	 	alert("请先创建TR069 WAN");
     	return;
	 }
	showOrHideLoadingWindowFromIframe("show");
	 var elementid = $(element).attr("id");
	 var postdata = new Object();
	 if(elementid == "Manual_IPV4")
	 {
		 $("#Manual_IPV4").css("background","#7CCD7C");
		 $("#Manual_IPV6").css("background","#F2F2F2");
		 postdata.IPMode = "1";
		 postdata.wan_session_index = wan_session_index;
	 }
	 else if(elementid == "Manual_IPV6")
	 {
		 $("#Manual_IPV6").css("background","#7CCD7C");
		 $("#Manual_IPV4").css("background","#F2F2F2");
		 postdata.IPMode = "2";
		 postdata.IPv6PrefixOrigin = "PrefixDelegation";
		 postdata.IPv6IPAddressOrigin = "DHCPv6";
		 postdata.wan_session_index = wan_session_index;
	 }
	 XHR.post("set_agreement_type", postdata, function(){
	 	showOrHideLoadingWindowFromIframe("hide");
	 });
}
